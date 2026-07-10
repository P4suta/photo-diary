use crate::db::Db;
use crate::model::{NewPhoto, Stats};
use crate::{exif, orient, scan, thumbnail, transcode, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};
use time::UtcOffset;

/// A single file that could not be imported (decode/EXIF/encode/IO failure). Collected so one
/// bad file never aborts the whole folder import.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportFailure {
    pub path: String,
    pub reason: String,
}

/// Summary of an import.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportSummary {
    pub imported: u32,
    /// Already-imported files skipped as duplicates.
    pub skipped: u32,
    /// Recognized-but-undecodable files (heic/heif/avif) that were skipped by policy.
    pub skipped_unsupported: u32,
    /// Total originals - total stored (AVIF). Bytes saved (can be negative).
    pub bytes_saved: i64,
    /// Files that failed to import; the rest of the folder still imported.
    pub failed: Vec<ImportFailure>,
    /// Directory-traversal errors (e.g. permission denied) encountered during the scan.
    pub scan_errors: Vec<String>,
}

/// Progress for one processed file during an import. Emitted through a caller-supplied callback
/// so the core stays framework-free (the Tauri layer forwards these over an IPC channel). serde is
/// camelCase to match the rest of the DTO surface. `current` counts files processed so far
/// (1..=`total`); `total` is the number of scanned candidate images.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub current: u32,
    pub total: u32,
    pub filename: String,
}

/// Per-file outcome of an import attempt.
enum ImportOutcome {
    /// Newly imported; carries bytes saved vs the original.
    Imported(i64),
    /// Skipped as an already-imported duplicate.
    Duplicate,
}

/// Facade over the internal library. Optimizes watched-folder photos to AVIF for permanent
/// storage and records metadata in SQLite. The Tauri command layer just calls this thin wrapper.
pub struct Library {
    /// The DB connection, behind a Mutex so the lock is held only around each brief DB access
    /// (not across the CPU-heavy hash/decode/AVIF encode work). This keeps a concurrent read from
    /// waiting on a whole import — it contends only with one file's exists-check or insert.
    db: Mutex<Db>,
    /// Root data directory. Stored so DB-relative paths (`library/…`, `thumbnails/…`) can be
    /// re-joined to absolute paths when producing DTOs.
    data_dir: PathBuf,
    /// Storage directory for AVIF masters (`data_dir/library`).
    store: PathBuf,
    /// Cache directory for display thumbnails (`data_dir/thumbnails`).
    thumbs: PathBuf,
    /// Local UTC offset captured once at open. EXIF datetimes are local wall-clock, so mtime/now
    /// fallbacks are formatted in this offset to keep every stored datetime on the same clock.
    offset: UtcOffset,
}

impl Library {
    /// Sets up the DB (`photo-diary.db`) and storage (`library/`, `thumbnails/`) under `data_dir`.
    pub fn open(data_dir: &Path) -> Result<Self> {
        let store = data_dir.join("library");
        let thumbs = data_dir.join("thumbnails");
        fs::create_dir_all(&store)?;
        fs::create_dir_all(&thumbs)?;
        let db = Db::open(&data_dir.join("photo-diary.db"))?;
        // Capture the local offset once, here in the single-threaded setup context (reading the
        // offset from a multi-threaded process is unsound and returns Err on many platforms).
        // Tradeoff: a fixed offset can't track a DST transition mid-session, so a datetime near
        // a DST boundary may be off by one hour — acceptable versus the up-to-9-hour (JST) error
        // of formatting local EXIF times against a UTC fallback. Falls back to UTC if unavailable.
        let offset = UtcOffset::current_local_offset().unwrap_or(UtcOffset::UTC);
        Ok(Self {
            db: Mutex::new(db),
            data_dir: data_dir.to_path_buf(),
            store,
            thumbs,
            offset,
        })
    }

    /// Scans a folder and, for not-yet-imported photos (no matching original_hash), converts
    /// them to AVIF, then stores and registers them. Already-imported ones are skipped (incremental import).
    pub fn import_folder(&self, folder: &Path) -> Result<ImportSummary> {
        self.import_folder_with_progress(folder, &|_| {})
    }

    /// Like [`Self::import_folder`], but invokes `on_progress` once per processed file so a caller
    /// (the Tauri layer) can forward live progress over an IPC channel. The callback is `Fn`, not a
    /// framework type, so the core stays independent of Tauri. `total` is the number of scanned
    /// candidate images; `current` runs 1..=`total` and counts every file processed (imported,
    /// duplicate, or failed) so the bar reaches completion regardless of per-file outcome.
    pub fn import_folder_with_progress(
        &self,
        folder: &Path,
        on_progress: &dyn Fn(ImportProgress),
    ) -> Result<ImportSummary> {
        // Register the folder and record this scan time; the returned id tags each photo.
        let folder_id = self
            .db()
            .upsert_folder(&folder.to_string_lossy(), &iso_local(now(), self.offset))?;

        let scan = scan::scan(folder)?;
        let total = scan.images.len() as u32;
        let mut summary = ImportSummary {
            imported: 0,
            skipped: 0,
            skipped_unsupported: scan.unsupported.len() as u32,
            bytes_saved: 0,
            failed: Vec::new(),
            scan_errors: scan.walk_errors,
        };

        // A failure on one file must not abort the folder: collect it and keep going.
        for (i, src) in scan.images.iter().enumerate() {
            match self.import_one(src, folder_id) {
                Ok(ImportOutcome::Imported(saved)) => {
                    summary.imported += 1;
                    summary.bytes_saved += saved;
                }
                Ok(ImportOutcome::Duplicate) => summary.skipped += 1,
                Err(e) => summary.failed.push(ImportFailure {
                    path: src.to_string_lossy().into_owned(),
                    reason: e.to_string(),
                }),
            }
            // Emit after the file is handled: `current` is the number of files completed so far.
            on_progress(ImportProgress {
                current: (i + 1) as u32,
                total,
                filename: src
                    .file_name()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_default(),
            });
        }

        Ok(summary)
    }

    /// Imports a single file. Any error (hash/EXIF/decode/encode/IO) is returned so the caller
    /// can record it and continue with the rest of the folder.
    fn import_one(&self, src: &Path, folder_id: i64) -> Result<ImportOutcome> {
        let hash = file_hash(src)?;
        // Brief lock: bind the result so the guard drops before the CPU-heavy decode/encode below.
        let exists = self.db().photo_exists(&hash)?;
        if exists {
            return Ok(ImportOutcome::Duplicate);
        }

        let meta = exif::read_meta(src)?;
        let taken_at = match meta.taken_at {
            Some(dt) => dt,
            None => mtime_iso(src, self.offset)?,
        };

        // Decode once, then apply EXIF orientation once; the upright pixels feed both the AVIF
        // master and the thumbnail so portrait photos are stored correctly (not sideways).
        let oriented = orient::apply_orientation(image::open(src)?, meta.orientation);

        // Paths are stored RELATIVE to the data dir (e.g. `library/abc.avif`) so the library
        // survives a drive/username/machine change; absolute paths are re-derived when needed.
        let stem = &hash[..16];
        let rel_store = format!("library/{stem}.avif");
        let avif = transcode::to_avif(&oriented, &self.data_dir.join(&rel_store), 85.0)?;

        // Thumbnails are a regenerable cache: if generation fails, record no path (None) rather
        // than a path to a file that was never written.
        let rel_thumb = format!("thumbnails/{stem}.webp");
        let thumb_path = thumbnail::make_thumbnail(&oriented, &self.data_dir.join(&rel_thumb), 512)
            .ok()
            .map(|_| rel_thumb);

        let orig_bytes = fs::metadata(src)?.len() as i64;
        let bytes_saved = orig_bytes - avif.bytes as i64;

        // Brief lock: only the insert touches the DB.
        self.db().insert_photo(&NewPhoto {
            store_path: rel_store,
            store_bytes: avif.bytes as i64,
            thumb_path,
            taken_at,
            lat: meta.lat,
            lng: meta.lng,
            width: avif.width,
            height: avif.height,
            original_filename: src
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default(),
            original_hash: hash,
            place: None,
            imported_at: iso_local(now(), self.offset),
            folder_id: Some(folder_id),
        })?;

        Ok(ImportOutcome::Imported(bytes_saved))
    }

    pub fn stats(&self) -> Result<Stats> {
        self.db().stats()
    }

    pub fn save_note(&self, date: &str, note: &str) -> Result<()> {
        self.db().set_note(date, note)
    }

    pub fn toggle_star(&self, photo_id: i64) -> Result<bool> {
        self.db().toggle_star(photo_id)
    }

    /// Internal storage directory (for the settings "open folder").
    pub fn store_dir(&self) -> &Path {
        &self.store
    }

    /// Locks and returns the data layer. Each caller holds the guard only for its own brief DB
    /// access — never across CPU or fs work (that would serialize reads behind an import). A
    /// poisoned lock (a panic while some other call held it) is recovered: individual statements
    /// leave the connection usable, so we take the guard rather than propagate the panic.
    pub fn db(&self) -> MutexGuard<'_, Db> {
        self.db.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// All photos (taken_at descending), with thumb paths resolved to absolute.
    pub fn list_photos(&self) -> Result<Vec<crate::dto::PhotoDto>> {
        self.db().all_photos(&self.data_dir)
    }

    /// Starred photos (taken_at descending), with thumb paths resolved to absolute.
    pub fn list_starred(&self) -> Result<Vec<crate::dto::PhotoDto>> {
        self.db().starred_photos(&self.data_dir)
    }

    /// Watched folders with real photo counts and last_scan, plus an fs-derived status. The
    /// fs check lives here (not in the Db, which stays fs-free): a folder whose path no longer
    /// exists is reported as `disconnected` so the UI can flag it.
    pub fn list_folders(&self) -> Result<Vec<crate::dto::FolderDto>> {
        // Bind first so the DB guard drops before the per-folder `is_dir()` fs checks below
        // (never hold the DB lock across filesystem IO).
        let rows = self.db().list_folders()?;
        Ok(rows
            .into_iter()
            .map(|r| {
                let status = if Path::new(&r.path).is_dir() {
                    "watching"
                } else {
                    "disconnected"
                };
                crate::dto::FolderDto {
                    id: r.id.to_string(),
                    path: r.path,
                    status: status.to_string(),
                    last_scan: r.last_scan,
                    photo_count: r.photo_count,
                }
            })
            .collect())
    }

    /// Library stats for the UI (includes storage size, thumbnail cache size, last import).
    pub fn stats_full(&self) -> Result<crate::dto::StatsDto> {
        // Acquire the lock once (std Mutex is not reentrant) for both DB reads, then drop it
        // before the `dir_size` fs walk — never hold the DB lock across filesystem IO.
        let (s, last_import) = {
            let db = self.db();
            (db.stats()?, db.last_import()?.unwrap_or_default())
        };
        Ok(crate::dto::StatsDto {
            used_bytes: s.used_bytes,
            photo_count: s.photo_count,
            day_count: s.day_count,
            starred_count: s.starred_count,
            thumbnail_cache_bytes: dir_size(&self.thumbs),
            location: self.store.to_string_lossy().into_owned(),
            last_import,
        })
    }
}

/// SHA-256 of file contents (dedup key). Streamed through a fixed buffer so large photos
/// don't get read fully into memory.
fn file_hash(path: &Path) -> Result<String> {
    let mut reader = std::io::BufReader::new(fs::File::open(path)?);
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Total file size directly under a directory (thumbnail cache size).
fn dir_size(dir: &Path) -> i64 {
    let Ok(entries) = fs::read_dir(dir) else {
        return 0;
    };
    entries
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len() as i64)
        .sum()
}

/// The current instant. Split out from formatting so the pure `iso_local` seam is testable.
fn now() -> time::OffsetDateTime {
    time::OffsetDateTime::now_utc()
}

/// Formats `instant` as ISO 8601 local wall-clock ("YYYY-MM-DDTHH:MM:SS") in `offset`.
/// Pure (no clock/fs): tests inject a fixed instant + known offset. No zone suffix is emitted,
/// matching EXIF-derived `taken_at`, so photos sort/group on a single local clock.
fn iso_local(instant: time::OffsetDateTime, offset: UtcOffset) -> String {
    let odt = instant.to_offset(offset);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
        odt.year(),
        u8::from(odt.month()),
        odt.day(),
        odt.hour(),
        odt.minute(),
        odt.second()
    )
}

/// File modification time as ISO 8601 local wall-clock in `offset`. Fallback `taken_at`
/// for photos without an EXIF capture datetime.
fn mtime_iso(path: &Path, offset: UtcOffset) -> Result<String> {
    let mtime = fs::metadata(path)?
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let secs = mtime
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0) as i64;
    let instant = time::OffsetDateTime::from_unix_timestamp(secs)
        .map_err(|e| crate::Error::Other(e.to_string()))?;
    Ok(iso_local(instant, offset))
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    fn make_lib(dir: &Path) -> Library {
        let db = Db::open_in_memory().unwrap();
        let store = dir.join("library");
        let thumbs = dir.join("thumbnails");
        fs::create_dir_all(&store).unwrap();
        fs::create_dir_all(&thumbs).unwrap();
        Library {
            db: Mutex::new(db),
            data_dir: dir.to_path_buf(),
            store,
            thumbs,
            // Fixed offset in tests so datetime formatting is deterministic across machines.
            offset: UtcOffset::UTC,
        }
    }

    fn write_png(path: &Path, w: u32, h: u32, tint: u8) {
        let img = RgbImage::from_fn(w, h, |x, y| Rgb([tint, (x % 256) as u8, (y % 256) as u8]));
        img.save(path).unwrap();
    }

    #[test]
    fn imports_new_photos_and_dedups_on_reimport() {
        let dir = tempfile::tempdir().unwrap();
        let lib = make_lib(dir.path());
        let src = dir.path().join("src");
        fs::create_dir_all(&src).unwrap();
        write_png(&src.join("a.png"), 32, 24, 10);
        write_png(&src.join("b.png"), 20, 20, 200);

        let first = lib.import_folder(&src).unwrap();
        assert_eq!(first.imported, 2);
        assert_eq!(first.skipped, 0);
        assert_eq!(lib.stats().unwrap().photo_count, 2);

        // Re-import is skipped as duplicate; the count doesn't grow.
        let second = lib.import_folder(&src).unwrap();
        assert_eq!(second.imported, 0);
        assert_eq!(second.skipped, 2);
        assert_eq!(lib.stats().unwrap().photo_count, 2);
    }

    #[test]
    fn stores_one_avif_master_per_photo() {
        let dir = tempfile::tempdir().unwrap();
        let lib = make_lib(dir.path());
        let src = dir.path().join("in");
        fs::create_dir_all(&src).unwrap();
        write_png(&src.join("p.png"), 40, 30, 128);

        lib.import_folder(&src).unwrap();

        let avifs = fs::read_dir(lib.store_dir())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().is_some_and(|x| x == "avif"))
            .count();
        assert_eq!(avifs, 1);
    }

    #[test]
    fn corrupt_file_is_reported_but_good_files_still_import() {
        let dir = tempfile::tempdir().unwrap();
        let lib = make_lib(dir.path());
        let src = dir.path().join("in");
        fs::create_dir_all(&src).unwrap();

        write_png(&src.join("good.png"), 24, 18, 77);
        // Garbage bytes with an image extension: decode/EXIF fails for this one only.
        fs::write(src.join("broken.jpg"), b"this is not a real jpeg").unwrap();

        let summary = lib.import_folder(&src).unwrap();

        assert_eq!(summary.imported, 1, "the good png still imports");
        assert_eq!(summary.failed.len(), 1, "the corrupt jpg is reported");
        assert!(summary.failed[0].path.ends_with("broken.jpg"));
        assert_eq!(lib.stats().unwrap().photo_count, 1);
    }

    #[test]
    fn unsupported_heic_is_counted_and_does_not_abort() {
        let dir = tempfile::tempdir().unwrap();
        let lib = make_lib(dir.path());
        let src = dir.path().join("in");
        fs::create_dir_all(&src).unwrap();

        write_png(&src.join("a.png"), 20, 20, 12);
        // Undecodable format: skipped by policy (not even attempted), so no failure recorded.
        fs::write(src.join("phone.heic"), b"not decoded anyway").unwrap();

        let summary = lib.import_folder(&src).unwrap();

        assert_eq!(summary.imported, 1);
        assert_eq!(summary.skipped_unsupported, 1);
        assert!(summary.failed.is_empty(), "heic is skipped, not failed");
        assert_eq!(lib.stats().unwrap().photo_count, 1);
    }

    #[test]
    fn import_emits_progress_per_file_up_to_total() {
        use std::cell::RefCell;
        let dir = tempfile::tempdir().unwrap();
        let lib = make_lib(dir.path());
        let src = dir.path().join("in");
        fs::create_dir_all(&src).unwrap();
        write_png(&src.join("a.png"), 20, 20, 1);
        write_png(&src.join("b.png"), 20, 20, 2);
        // A heic is unsupported (excluded from candidates), so it must NOT count toward `total`.
        fs::write(src.join("phone.heic"), b"nope").unwrap();

        let events: RefCell<Vec<ImportProgress>> = RefCell::new(Vec::new());
        lib.import_folder_with_progress(&src, &|p| events.borrow_mut().push(p))
            .unwrap();

        let events = events.into_inner();
        // One event per scanned candidate image (the two pngs), heic excluded.
        assert_eq!(events.len(), 2);
        for e in &events {
            assert_eq!(e.total, 2, "total is the candidate-image count");
        }
        // `current` runs 1..=total and reaches completion.
        assert_eq!(events[0].current, 1);
        assert_eq!(events[1].current, 2);
        let mut names: Vec<&str> = events.iter().map(|e| e.filename.as_str()).collect();
        names.sort_unstable();
        assert_eq!(names, vec!["a.png", "b.png"]);
    }

    #[test]
    fn list_folders_status_reflects_filesystem_presence() {
        let dir = tempfile::tempdir().unwrap();
        let lib = make_lib(dir.path());

        let present = dir.path().join("present");
        fs::create_dir_all(&present).unwrap();
        write_png(&present.join("p.png"), 20, 20, 5);
        lib.import_folder(&present).unwrap();
        // Register a folder whose path does not exist on disk.
        lib.db()
            .upsert_folder("/no/such/folder", "2026-07-04T10:00:00")
            .unwrap();

        let folders = lib.list_folders().unwrap();
        let status = |path: &str| {
            folders
                .iter()
                .find(|f| f.path.ends_with(path))
                .map(|f| f.status.as_str())
                .unwrap()
        };
        assert_eq!(status("present"), "watching", "existing dir is watched");
        assert_eq!(status("folder"), "disconnected", "missing dir is flagged");
    }

    #[test]
    fn stores_relative_paths_but_dtos_are_absolute() {
        let dir = tempfile::tempdir().unwrap();
        let lib = make_lib(dir.path());
        let src = dir.path().join("in");
        fs::create_dir_all(&src).unwrap();
        write_png(&src.join("p.png"), 40, 30, 128);
        lib.import_folder(&src).unwrap();

        // DB columns keep paths relative to the data dir (drive/machine independent).
        let (store_path, thumb_path): (String, Option<String>) = lib
            .db()
            .conn
            .query_row("SELECT store_path, thumb_path FROM photos", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert!(
            store_path.starts_with("library/") && store_path.ends_with(".avif"),
            "store_path is relative: {store_path}"
        );
        let rel_thumb = thumb_path.as_deref().expect("thumb written");
        assert!(
            rel_thumb.starts_with("thumbnails/"),
            "thumb_path is relative: {rel_thumb}"
        );

        // The DTO surface re-joins with the data dir so the frontend gets an ABSOLUTE path.
        let dto = &lib.list_photos().unwrap()[0];
        let abs = dto.thumb_path.as_deref().expect("thumb in dto");
        assert!(
            Path::new(abs).is_absolute() && Path::new(abs).starts_with(dir.path()),
            "dto thumb_path is absolute under the data dir: {abs}"
        );

        // The full-resolution master path gets the same absolute-join treatment (R3): the
        // lightbox needs an absolute path for convertFileSrc.
        let store_abs = Path::new(&dto.store_path);
        assert!(
            store_abs.is_absolute()
                && store_abs.starts_with(dir.path())
                && dto.store_path.ends_with(".avif"),
            "dto store_path is an absolute master path under the data dir: {}",
            dto.store_path
        );
    }

    #[test]
    fn iso_local_formats_in_the_injected_offset() {
        // 2026-07-04T00:30:00 UTC. In UTC+9 (JST) that is 09:30 the SAME day; in UTC it is
        // 00:30. The offset must move the wall-clock, proving mtime/now aren't stuck on UTC.
        let instant = time::OffsetDateTime::from_unix_timestamp(1_783_125_000).unwrap();
        assert_eq!(iso_local(instant, UtcOffset::UTC), "2026-07-04T00:30:00");
        let jst = UtcOffset::from_hms(9, 0, 0).unwrap();
        assert_eq!(iso_local(instant, jst), "2026-07-04T09:30:00");
    }

    #[test]
    fn iso_local_can_roll_the_date_across_midnight() {
        // 2026-07-03T20:00:00 UTC is 2026-07-04T05:00:00 in JST: the DAY differs, which is
        // exactly the misfiling this offset unification fixes.
        let instant = time::OffsetDateTime::from_unix_timestamp(1_783_108_800).unwrap();
        assert_eq!(iso_local(instant, UtcOffset::UTC), "2026-07-03T20:00:00");
        let jst = UtcOffset::from_hms(9, 0, 0).unwrap();
        assert_eq!(iso_local(instant, jst), "2026-07-04T05:00:00");
    }

    #[test]
    fn mtime_iso_respects_the_injected_offset() {
        // mtime_iso reads the fs mtime, then formats through the same offset seam.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("f.bin");
        fs::write(&path, b"x").unwrap();
        let filetime = SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_783_125_000);
        let f = fs::File::options().write(true).open(&path).unwrap();
        f.set_modified(filetime).unwrap();

        assert_eq!(
            mtime_iso(&path, UtcOffset::UTC).unwrap(),
            "2026-07-04T00:30:00"
        );
        let jst = UtcOffset::from_hms(9, 0, 0).unwrap();
        assert_eq!(mtime_iso(&path, jst).unwrap(), "2026-07-04T09:30:00");
    }
}
