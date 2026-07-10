//! Tauri shell for photo-diary. Delegates real work to photo-diary-core and stays a thin
//! command layer (the invoke surface matching the frontend's `PhotoLibrary` port).
//! Reads return raw-data DTOs; presentation is built by pure functions on the frontend.

use photo_diary_core::dto::{
    DayCountDto, FolderDto, MonthRecordDto, NoteDto, PhotoDto, PlaceFacetDto, StatsDto,
};
use photo_diary_core::{ImportProgress, ImportSummary, Library};
use serde::Serialize;
use std::path::Path;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::{Manager, State};

/// App state: the `Library` synchronizes DB access with an internal Mutex (locking only around
/// each brief DB touch, not the CPU-heavy import work), so it is `Send + Sync`. We share it as an
/// `Arc` so a command can clone it into a blocking task without holding a guard across `.await`.
type LibState = Arc<Library>;

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
    state: State<'_, LibState>,
) -> Result<ImportDto, String> {
    // Clone the Arc so the blocking task owns a handle (State can't cross into spawn_blocking).
    let lib = state.inner().clone();
    let summary = tauri::async_runtime::spawn_blocking(move || {
        lib.import_folder_with_progress(Path::new(&path), &|p| {
            // A dropped receiver (e.g. window closed) shouldn't abort the import.
            let _ = on_progress.send(p);
        })
    })
    .await
    .map_err(|e| e.to_string())? // JoinError (task panicked/cancelled)
    .map_err(|e| e.to_string())?; // import error
    Ok(summary.into())
}

/// All photos (taken_at descending). The frontend uses this for day grouping/highlights.
#[tauri::command]
async fn list_photos(state: State<'_, LibState>) -> Result<Vec<PhotoDto>, String> {
    state.list_photos().map_err(|e| e.to_string())
}

/// Starred photos.
#[tauri::command]
async fn list_starred(state: State<'_, LibState>) -> Result<Vec<PhotoDto>, String> {
    state.list_starred().map_err(|e| e.to_string())
}

/// All day notes.
#[tauri::command]
async fn list_notes(state: State<'_, LibState>) -> Result<Vec<NoteDto>, String> {
    state.db().all_notes().map_err(|e| e.to_string())
}

/// Per-date photo counts for a year (for the heatmap).
#[tauri::command]
async fn year_counts(year: i32, state: State<'_, LibState>) -> Result<Vec<DayCountDto>, String> {
    state.db().year_counts(year).map_err(|e| e.to_string())
}

/// Per-day records for a year-month (for the calendar).
#[tauri::command]
async fn month_records(
    year: i32,
    month: u32,
    state: State<'_, LibState>,
) -> Result<Vec<MonthRecordDto>, String> {
    state
        .db()
        .month_records(year, month)
        .map_err(|e| e.to_string())
}

/// List of watched folders (real photo counts, last_scan, and fs-derived status).
#[tauri::command]
async fn list_folders(state: State<'_, LibState>) -> Result<Vec<FolderDto>, String> {
    state.list_folders().map_err(|e| e.to_string())
}

/// Place facets (for search).
#[tauri::command]
async fn place_facets(state: State<'_, LibState>) -> Result<Vec<PlaceFacetDto>, String> {
    state.db().place_facets().map_err(|e| e.to_string())
}

/// Library statistics.
#[tauri::command]
async fn get_stats(state: State<'_, LibState>) -> Result<StatsDto, String> {
    state.stats_full().map_err(|e| e.to_string())
}

/// Saves a day's note (an empty note deletes the day's note row).
#[tauri::command]
async fn save_note(date: String, note: String, state: State<'_, LibState>) -> Result<(), String> {
    state.save_note(&date, &note).map_err(|e| e.to_string())
}

/// Toggles a photo's star and returns the new state.
#[tauri::command]
async fn toggle_star(photo_id: i64, state: State<'_, LibState>) -> Result<bool, String> {
    state.toggle_star(photo_id).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Set up the DB and library storage under the app data directory.
            let dir = app.path().app_data_dir()?;
            let lib = Library::open(&dir)?;
            app.manage(Arc::new(lib));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_folder,
            list_photos,
            list_starred,
            list_notes,
            year_counts,
            month_records,
            list_folders,
            place_facets,
            get_stats,
            save_note,
            toggle_star
        ])
        .run(tauri::generate_context!())
        .expect("error while running photo-diary");
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
