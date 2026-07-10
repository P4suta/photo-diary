use crate::db::Db;
use crate::model::{NewPhoto, Stats};
use crate::{exif, scan, thumbnail, transcode, Result};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Summary of an import.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportSummary {
    pub imported: u32,
    pub skipped: u32,
    /// Total originals - total stored (AVIF). Bytes saved (can be negative).
    pub bytes_saved: i64,
}

/// Facade over the internal library. Optimizes watched-folder photos to AVIF for permanent
/// storage and records metadata in SQLite. The Tauri command layer just calls this thin wrapper.
pub struct Library {
    db: Db,
    /// Storage directory for AVIF masters.
    store: PathBuf,
    /// Cache directory for display thumbnails.
    thumbs: PathBuf,
}

impl Library {
    /// Sets up the DB (`photo-diary.db`) and storage (`library/`, `thumbnails/`) under `data_dir`.
    pub fn open(data_dir: &Path) -> Result<Self> {
        let store = data_dir.join("library");
        let thumbs = data_dir.join("thumbnails");
        fs::create_dir_all(&store)?;
        fs::create_dir_all(&thumbs)?;
        let db = Db::open(&data_dir.join("photo-diary.db"))?;
        Ok(Self { db, store, thumbs })
    }

    /// Scans a folder and, for not-yet-imported photos (no matching original_hash), converts
    /// them to AVIF, then stores and registers them. Already-imported ones are skipped (incremental import).
    pub fn import_folder(&self, folder: &Path) -> Result<ImportSummary> {
        self.db.upsert_folder(&folder.to_string_lossy())?;
        let mut imported = 0;
        let mut skipped = 0;
        let mut bytes_saved: i64 = 0;

        for src in scan::scan_images(folder)? {
            let hash = file_hash(&src)?;
            if self.db.photo_exists(&hash)? {
                skipped += 1;
                continue;
            }

            let meta = exif::read_meta(&src)?;
            let taken_at = match meta.taken_at {
                Some(dt) => dt,
                None => mtime_iso(&src)?,
            };

            let stem = &hash[..16];
            let store_path = self.store.join(format!("{stem}.avif"));
            let avif = transcode::to_avif(&src, &store_path, 85.0)?;

            // Generate the display thumbnail from the original (AVIF has no decoder here, so use the original).
            // If it fails, continue the import anyway (thumbnails are a regenerable cache).
            let thumb_path = self.thumbs.join(format!("{stem}.webp"));
            let _ = thumbnail::make_thumbnail(&src, &thumb_path, 512);

            let orig_bytes = fs::metadata(&src)?.len() as i64;
            bytes_saved += orig_bytes - avif.bytes as i64;

            self.db.insert_photo(&NewPhoto {
                store_path: store_path.to_string_lossy().into_owned(),
                store_bytes: avif.bytes as i64,
                thumb_path: Some(thumb_path.to_string_lossy().into_owned()),
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
                imported_at: now_iso(),
            })?;
            imported += 1;
        }

        Ok(ImportSummary {
            imported,
            skipped,
            bytes_saved,
        })
    }

    pub fn stats(&self) -> Result<Stats> {
        self.db.stats()
    }

    pub fn save_note(&self, date: &str, note: &str) -> Result<()> {
        self.db.set_note(date, note)
    }

    pub fn toggle_star(&self, photo_id: i64) -> Result<bool> {
        self.db.toggle_star(photo_id)
    }

    /// Internal storage directory (for the settings "open folder").
    pub fn store_dir(&self) -> &Path {
        &self.store
    }

    /// Reference to the data layer (for the command layer's read queries).
    pub fn db(&self) -> &Db {
        &self.db
    }

    /// Library stats for the UI (includes storage size, thumbnail cache size, last import).
    pub fn stats_full(&self) -> Result<crate::dto::StatsDto> {
        let s = self.db.stats()?;
        Ok(crate::dto::StatsDto {
            used_bytes: s.used_bytes,
            photo_count: s.photo_count,
            day_count: s.day_count,
            starred_count: s.starred_count,
            thumbnail_cache_bytes: dir_size(&self.thumbs),
            location: self.store.to_string_lossy().into_owned(),
            last_import: self.db.last_import()?.unwrap_or_default(),
        })
    }
}

/// SHA-256 of file contents (dedup key).
fn file_hash(path: &Path) -> Result<String> {
    let bytes = fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
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

/// Returns the current time in ISO 8601 ("YYYY-MM-DDTHH:MM:SS", UTC) (for import timestamps).
fn now_iso() -> String {
    let odt = time::OffsetDateTime::now_utc();
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

/// File modification time as ISO 8601 ("YYYY-MM-DDTHH:MM:SS", UTC). Fallback taken_at
/// for photos without an EXIF capture datetime.
fn mtime_iso(path: &Path) -> Result<String> {
    let mtime = fs::metadata(path)?
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let secs = mtime
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0) as i64;
    let odt = time::OffsetDateTime::from_unix_timestamp(secs)
        .map_err(|e| crate::Error::Other(e.to_string()))?;
    Ok(format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
        odt.year(),
        u8::from(odt.month()),
        odt.day(),
        odt.hour(),
        odt.minute(),
        odt.second()
    ))
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
        Library { db, store, thumbs }
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
}
