//! Tauri shell for photo-diary. Delegates real work to photo-diary-core and stays a thin
//! command layer (the invoke surface matching the frontend's `PhotoLibrary` port).
//! Reads return raw-data DTOs; presentation is built by pure functions on the frontend.

use photo_diary_core::dto::{
    DayCountDto, DayPhotosPageDto, DaySummaryDto, EventOverrideDto, FolderDto, MonthRecordDto,
    NoteDto, PhotoDto, PlaceFacetDto, StatsDto, TimelineDayDto, TimelineFilterDto,
};
use photo_diary_core::model::EventOverride;
#[cfg(feature = "native-e2e")]
use photo_diary_core::model::NewPhoto;
use photo_diary_core::{
    CacheSummary, FolderFingerprint, FolderMonitor, ImportProgress, ImportSummary, JobManager,
    JobState, Library, OfflinePlaceResolver,
};
use serde::Serialize;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant, UNIX_EPOCH};
use tauri::ipc::Channel;
use tauri::{Emitter, Manager, State};

/// App state: the `Library` synchronizes DB access with an internal Mutex (locking only around
/// each brief DB touch, not the CPU-heavy import work), so it is `Send + Sync`. We share it as an
/// `Arc` so a command can clone it into a blocking task without holding a guard across `.await`.
struct AppState {
    library: Arc<Library>,
    jobs: Arc<JobManager>,
}

type SharedState = Arc<AppState>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportDto {
    imported: u32,
    skipped: u32,
    skipped_unsupported: u32,
    bytes_saved: i64,
    failed: Vec<ImportFailureDto>,
    scan_errors: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportFailureDto {
    path: String,
    reason: String,
}

impl From<ImportSummary> for ImportDto {
    fn from(s: ImportSummary) -> Self {
        ImportDto {
            imported: s.imported,
            skipped: s.skipped,
            skipped_unsupported: s.skipped_unsupported,
            bytes_saved: s.bytes_saved,
            failed: s
                .failed
                .into_iter()
                .map(|f| ImportFailureDto {
                    path: f.path,
                    reason: f.reason,
                })
                .collect(),
            scan_errors: s.scan_errors,
        }
    }
}

/// Imports a folder (scan -> EXIF -> AVIF -> thumbnail -> SQLite; duplicates skipped).
///
/// The heavy work (hash/EXIF/decode/AVIF encode) runs on a blocking task via `spawn_blocking` so
/// it never freezes the main thread, and the `Library` locks the DB only per file, so reads issued
/// mid-import don't wait for the whole import. `on_progress` is a per-call IPC channel: one
/// `ImportProgress { current, total, filename }` is emitted per processed file (camelCase).
#[tauri::command]
async fn import_folder(
    path: String,
    on_progress: Channel<ImportProgress>,
    state: State<'_, SharedState>,
) -> Result<ImportDto, String> {
    // Clone the Arc so the blocking task owns a handle (State can't cross into spawn_blocking).
    let app = state.inner().clone();
    let summary = tauri::async_runtime::spawn_blocking(move || {
        let _job = app.jobs.try_start()?;
        app.library.import_folder_with_control(
            Path::new(&path),
            &|p| {
                // A dropped receiver (e.g. window closed) shouldn't abort the import.
                let _ = on_progress.send(p);
            },
            &|| app.jobs.wait_if_paused(),
        )
    })
    .await
    .map_err(|e| e.to_string())? // JoinError (task panicked/cancelled)
    .map_err(|e| e.to_string())?; // import error
    Ok(summary.into())
}

/// All photos (taken_at descending). The frontend uses this for day grouping/highlights.
#[tauri::command]
async fn list_photos(state: State<'_, SharedState>) -> Result<Vec<PhotoDto>, String> {
    state.library.list_photos().map_err(|e| e.to_string())
}

/// Starred photos.
#[tauri::command]
async fn list_starred(state: State<'_, SharedState>) -> Result<Vec<PhotoDto>, String> {
    state.library.list_starred().map_err(|e| e.to_string())
}

/// All day notes.
#[tauri::command]
async fn list_notes(state: State<'_, SharedState>) -> Result<Vec<NoteDto>, String> {
    state.library.db().all_notes().map_err(|e| e.to_string())
}

/// Per-date photo counts for a year (for the heatmap).
#[tauri::command]
async fn year_counts(year: i32, state: State<'_, SharedState>) -> Result<Vec<DayCountDto>, String> {
    state
        .library
        .db()
        .year_counts(year)
        .map_err(|e| e.to_string())
}

/// Per-day records for a year-month (for the calendar).
#[tauri::command]
async fn month_records(
    year: i32,
    month: u32,
    state: State<'_, SharedState>,
) -> Result<Vec<MonthRecordDto>, String> {
    state
        .library
        .db()
        .month_records(year, month)
        .map_err(|e| e.to_string())
}

/// List of watched folders (real photo counts, last_scan, and fs-derived status).
#[tauri::command]
async fn list_folders(state: State<'_, SharedState>) -> Result<Vec<FolderDto>, String> {
    state.library.list_folders().map_err(|e| e.to_string())
}

/// Place facets (for search).
#[tauri::command]
async fn place_facets(
    filter: Option<TimelineFilterDto>,
    state: State<'_, SharedState>,
) -> Result<Vec<PlaceFacetDto>, String> {
    state
        .library
        .db()
        .place_facets_filtered(&filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Library statistics.
#[tauri::command]
async fn get_stats(state: State<'_, SharedState>) -> Result<StatsDto, String> {
    state.library.stats_full().map_err(|e| e.to_string())
}

/// Saves a day's note (an empty note deletes the day's note row).
#[tauri::command]
async fn save_note(
    date: String,
    note: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state
        .library
        .save_note(&date, &note)
        .map_err(|e| e.to_string())
}

/// Toggles a photo's star and returns the new state.
#[tauri::command]
async fn toggle_star(photo_id: i64, state: State<'_, SharedState>) -> Result<bool, String> {
    state
        .library
        .toggle_star(photo_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_timeline(
    filter: Option<TimelineFilterDto>,
    state: State<'_, SharedState>,
) -> Result<Vec<TimelineDayDto>, String> {
    state
        .library
        .db()
        .timeline_days(
            &filter.unwrap_or_default(),
            state
                .library
                .store_dir()
                .parent()
                .expect("library has data dir"),
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_day_summary(
    date: String,
    state: State<'_, SharedState>,
) -> Result<DaySummaryDto, String> {
    state
        .library
        .db()
        .day_summary(&date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_day_photos(
    date: String,
    cursor: Option<String>,
    limit: usize,
    starred_only: bool,
    state: State<'_, SharedState>,
) -> Result<DayPhotosPageDto, String> {
    state
        .library
        .db()
        .day_photos_page(
            &date,
            cursor.as_deref(),
            limit,
            starred_only,
            state
                .library
                .store_dir()
                .parent()
                .expect("library has data dir"),
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_caption(
    photo_id: i64,
    caption: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state
        .library
        .save_caption(photo_id, &caption)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_starred(
    photo_ids: Vec<i64>,
    starred: bool,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state
        .library
        .set_starred(&photo_ids, starred)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_event_overrides(
    state: State<'_, SharedState>,
) -> Result<Vec<EventOverrideDto>, String> {
    state
        .library
        .db()
        .event_overrides()
        .map(|events| events.into_iter().map(Into::into).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_event_metadata(
    id: String,
    start_date: String,
    end_date: String,
    title: String,
    note: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state
        .library
        .save_event_metadata(&EventOverride {
            id,
            start_date,
            end_date,
            title,
            note: note.and_then(|value| (!value.trim().is_empty()).then_some(value)),
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rescan_folder(folder_id: i64, state: State<'_, SharedState>) -> Result<ImportDto, String> {
    let folder = state
        .library
        .list_folders()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|folder| folder.id == folder_id.to_string())
        .ok_or_else(|| "watched folder not found".to_string())?;
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _job = app.jobs.try_start()?;
        app.library
            .import_folder_with_control(Path::new(&folder.path), &|_| {}, &|| {
                app.jobs.wait_if_paused()
            })
    })
    .await
    .map_err(|e| e.to_string())?
    .map(Into::into)
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_folder(folder_id: i64, state: State<'_, SharedState>) -> Result<(), String> {
    state
        .library
        .remove_folder(folder_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_import_paused(paused: bool, state: State<'_, SharedState>) -> Result<(), String> {
    state.jobs.set_paused(paused);
    Ok(())
}

#[tauri::command]
async fn get_job_state(state: State<'_, SharedState>) -> Result<JobState, String> {
    Ok(state.jobs.state())
}

#[tauri::command]
async fn clear_thumbnail_cache(state: State<'_, SharedState>) -> Result<u32, String> {
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _job = app.jobs.try_start()?;
        app.library.clear_thumbnail_cache()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn regenerate_thumbnail_cache(state: State<'_, SharedState>) -> Result<CacheSummary, String> {
    let app = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _job = app.jobs.try_start()?;
        app.library.regenerate_thumbnail_cache()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_photo(
    photo_id: i64,
    destination: String,
    state: State<'_, SharedState>,
) -> Result<u64, String> {
    state
        .library
        .export_photo(photo_id, Path::new(&destination))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_library(state: State<'_, SharedState>) -> Result<(), String> {
    open_in_file_manager(state.library.store_dir())
}

#[cfg(feature = "native-e2e")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeAcceptanceSeed {
    event_start: String,
    event_end: String,
    large_date: String,
    inserted: u32,
}

/// Feature-isolated fixture insertion for native acceptance tests. The rows live in the real
/// SQLite database and are consumed through the normal read/UI paths; no product build registers
/// this command.
#[cfg(feature = "native-e2e")]
#[tauri::command]
async fn seed_native_acceptance_data(
    state: State<'_, SharedState>,
) -> Result<NativeAcceptanceSeed, String> {
    let event_start = "2026-07-10";
    let event_end = "2026-07-11";
    let large_date = "2026-07-08";
    let mut inserted = 0;
    let db = state.library.db();
    for (date, count, split_places) in [
        (event_start, 200usize, false),
        (event_end, 200usize, false),
        (large_date, 240usize, true),
    ] {
        for index in 0..count {
            let (minute, place) = if split_places && index >= count / 2 {
                (14 * 60 + index - count / 2, "Osaka, JP")
            } else {
                (8 * 60 + index.min(count / 2 - 1), "Kyoto, JP")
            };
            let hour = minute / 60;
            let minute = minute % 60;
            let hash = format!("native-e2e-{date}-{index:03}");
            if db.photo_exists(&hash).map_err(|error| error.to_string())? {
                continue;
            }
            db.insert_photo(&NewPhoto {
                store_path: format!("library/{hash}.avif"),
                store_bytes: 1,
                thumb_path: None,
                taken_at: format!("{date}T{hour:02}:{minute:02}:00"),
                lat: None,
                lng: None,
                width: 64,
                height: 64,
                original_filename: format!("{hash}.png"),
                original_hash: hash,
                place: Some(place.to_string()),
                imported_at: "2026-07-25T12:00:00".to_string(),
                folder_id: None,
            })
            .map_err(|error| error.to_string())?;
            inserted += 1;
        }
    }
    Ok(NativeAcceptanceSeed {
        event_start: event_start.to_string(),
        event_end: event_end.to_string(),
        large_date: large_date.to_string(),
        inserted,
    })
}

macro_rules! photo_diary_handlers {
    ($($extra:ident),* $(,)?) => {
        tauri::generate_handler![
            import_folder,
            list_timeline,
            get_day_summary,
            get_day_photos,
            list_photos,
            list_starred,
            list_notes,
            year_counts,
            month_records,
            list_folders,
            place_facets,
            get_stats,
            save_note,
            toggle_star,
            save_caption,
            set_starred,
            list_event_overrides,
            save_event_metadata,
            rescan_folder,
            remove_folder,
            set_import_paused,
            get_job_state,
            clear_thumbnail_cache,
            regenerate_thumbnail_cache,
            export_photo,
            open_library,
            $($extra),*
        ]
    };
}

pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());
    #[cfg(feature = "native-e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio::init())
        .plugin(tauri_plugin_wdio_webdriver::init());

    let builder = builder.setup(|app| {
        // Set up the DB and library storage under the app's LOCAL data dir (not Roaming):
        // a multi-GB AVIF library must not sync in Windows domain/roaming-profile environments.
        let dir = app_data_dir(app)?;
        let state = Arc::new(AppState {
            library: Arc::new(Library::open(&dir)?),
            jobs: JobManager::new(),
        });
        app.manage(Arc::clone(&state));
        start_background_services(app.handle().clone(), state);
        Ok(())
    });
    #[cfg(feature = "native-e2e")]
    let builder = builder.invoke_handler(photo_diary_handlers!(seed_native_acceptance_data));
    #[cfg(not(feature = "native-e2e"))]
    let builder = builder.invoke_handler(photo_diary_handlers!());
    builder
        .run(tauri::generate_context!())
        .expect("error while running photo-diary");
}

fn app_data_dir(app: &tauri::App) -> tauri::Result<PathBuf> {
    #[cfg(feature = "native-e2e")]
    if let Some(path) = std::env::var_os("PHOTO_DIARY_E2E_DATA_DIR") {
        return Ok(PathBuf::from(path));
    }
    app.path().app_local_data_dir()
}

fn start_background_services(handle: tauri::AppHandle, state: SharedState) {
    let place_handle = handle.clone();
    let place_state = Arc::clone(&state);
    std::thread::spawn(move || {
        let Ok(_job) = place_state.jobs.try_start() else {
            return;
        };
        let resolver = OfflinePlaceResolver::new();
        let _ = place_state
            .library
            .backfill_places(&resolver, &|current, total| {
                let _ = place_handle.emit(
                    "library://place-progress",
                    serde_json::json!({ "current": current, "total": total }),
                );
            });
        let _ = place_handle.emit("library://changed", "places");
    });

    std::thread::spawn(move || monitor_folders(handle, state));
}

fn monitor_folders(handle: tauri::AppHandle, state: SharedState) {
    let started = Instant::now();
    let mut monitor = FolderMonitor::default();
    loop {
        let folders = match state.library.list_folders() {
            Ok(folders) => folders,
            Err(_) => {
                std::thread::sleep(Duration::from_secs(2));
                continue;
            }
        };
        monitor.retain_registered(folders.iter().map(|folder| folder.path.as_str()));
        for folder in folders {
            let now = started.elapsed();
            if !monitor.should_probe(&folder.path, now) {
                continue;
            }
            let path = PathBuf::from(&folder.path);
            if !path.is_dir() {
                monitor.observe_disconnected(&folder.path, now);
                continue;
            }
            let fingerprint = folder_fingerprint(&path);
            if !monitor.observe_connected(&folder.path, fingerprint, now) {
                continue;
            }
            // A busy explicit import wins. Because the monitor acknowledges only after success,
            // this stable pending fingerprint is retried on the next poll.
            let Ok(_job) = state.jobs.try_start() else {
                continue;
            };
            let result = state
                .library
                .import_folder_with_control(&path, &|_| {}, &|| state.jobs.wait_if_paused());
            if result.is_ok() {
                monitor.mark_imported(&folder.path, fingerprint);
                let _ = handle.emit("library://changed", "folder");
            }
        }
        std::thread::sleep(Duration::from_secs(2));
    }
}

fn folder_fingerprint(path: &Path) -> FolderFingerprint {
    let Ok(scan) = photo_diary_core::scan::scan(path) else {
        return FolderFingerprint {
            signature: 0,
            file_count: 0,
        };
    };
    let mut files = scan.images;
    files.extend(scan.unsupported);
    files.sort();
    let mut hasher = DefaultHasher::new();
    for file in &files {
        file.strip_prefix(path).unwrap_or(file).hash(&mut hasher);
        if let Ok(metadata) = file.metadata() {
            metadata.len().hash(&mut hasher);
            metadata
                .modified()
                .ok()
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_nanos())
                .hash(&mut hasher);
        }
    }
    FolderFingerprint {
        signature: hasher.finish(),
        file_count: files.len(),
    }
}

fn open_in_file_manager(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = std::process::Command::new("explorer.exe");
        command.arg(path);
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = std::process::Command::new("open");
        command.arg(path);
        command
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = std::process::Command::new("xdg-open");
        command.arg(path);
        command
    };
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    // Serde wire-contract tests for the shell-owned DTOs. They exercise only the serializable
    // structs (no tauri runtime), pinning the exact camelCase JSON the frontend's `commands.ts`
    // decodes for `import_folder` and its progress channel.
    use super::{ImportDto, ImportFailureDto};
    use photo_diary_core::{ImportFailure, ImportProgress, ImportSummary};
    use serde_json::Value;
    use std::collections::BTreeSet;

    fn keys(v: &Value) -> BTreeSet<String> {
        v.as_object().unwrap().keys().cloned().collect()
    }

    fn expect(list: &[&str]) -> BTreeSet<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn import_dto_serializes_exact_camelcase_keys_with_nested_failures() {
        let dto = ImportDto {
            imported: 3,
            skipped: 1,
            skipped_unsupported: 2,
            bytes_saved: -42,
            failed: vec![ImportFailureDto {
                path: "a/b.heic".into(),
                reason: "decode failed".into(),
            }],
            scan_errors: vec!["permission denied".into()],
        };
        let v = serde_json::to_value(&dto).unwrap();
        assert_eq!(
            keys(&v),
            expect(&[
                "imported",
                "skipped",
                "skippedUnsupported",
                "bytesSaved",
                "failed",
                "scanErrors",
            ])
        );
        // `failed` is an array of { path, reason }.
        assert!(v["failed"].is_array());
        let f = &v["failed"][0];
        assert_eq!(keys(f), expect(&["path", "reason"]));
        assert_eq!(f["path"], "a/b.heic");
        assert_eq!(f["reason"], "decode failed");
        // `scanErrors` is a JSON array of strings; `bytesSaved` keeps its sign.
        assert!(v["scanErrors"].is_array());
        assert_eq!(v["scanErrors"][0], "permission denied");
        assert_eq!(v["bytesSaved"], -42);
    }

    #[test]
    fn import_dto_from_summary_maps_every_field() {
        let summary = ImportSummary {
            imported: 5,
            skipped: 2,
            skipped_unsupported: 1,
            bytes_saved: 1000,
            failed: vec![ImportFailure {
                path: "x.jpg".into(),
                reason: "io".into(),
            }],
            scan_errors: vec!["walk error".into()],
        };
        let v = serde_json::to_value(ImportDto::from(summary)).unwrap();
        assert_eq!(v["imported"], 5);
        assert_eq!(v["skipped"], 2);
        assert_eq!(v["skippedUnsupported"], 1);
        assert_eq!(v["bytesSaved"], 1000);
        assert_eq!(v["failed"][0]["path"], "x.jpg");
        assert_eq!(v["failed"][0]["reason"], "io");
        assert_eq!(v["scanErrors"][0], "walk error");
    }

    #[test]
    fn import_progress_event_payload_serializes_camelcase() {
        let p = ImportProgress {
            current: 4,
            total: 10,
            filename: "IMG_0004.jpg".into(),
        };
        let v = serde_json::to_value(&p).unwrap();
        assert_eq!(keys(&v), expect(&["current", "total", "filename"]));
        assert_eq!(v["current"], 4);
        assert_eq!(v["total"], 10);
        assert_eq!(v["filename"], "IMG_0004.jpg");
    }
}
