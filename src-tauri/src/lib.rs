//! Tauri shell for photo-diary. Delegates real work to photo-diary-core and stays a thin
//! command layer (the invoke surface matching the frontend's `PhotoLibrary` port).
//! Reads return raw-data DTOs; presentation is built by pure functions on the frontend.

use photo_diary_core::dto::{
    DayCountDto, FolderDto, MonthRecordDto, NoteDto, PhotoDto, PlaceFacetDto, StatsDto,
};
use photo_diary_core::Library;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{Manager, State};

/// App state: rusqlite's Connection isn't Sync, so wrap it in a Mutex.
type LibState = Mutex<Library>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportDto {
    imported: u32,
    skipped: u32,
    bytes_saved: i64,
}

/// Imports a folder (scan -> EXIF -> AVIF -> thumbnail -> SQLite; duplicates skipped).
#[tauri::command]
fn import_folder(path: String, state: State<'_, LibState>) -> Result<ImportDto, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    let s = lib
        .import_folder(std::path::Path::new(&path))
        .map_err(|e| e.to_string())?;
    Ok(ImportDto {
        imported: s.imported,
        skipped: s.skipped,
        bytes_saved: s.bytes_saved,
    })
}

/// All photos (taken_at descending). The frontend uses this for day grouping/highlights.
#[tauri::command]
fn list_photos(state: State<'_, LibState>) -> Result<Vec<PhotoDto>, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.db().all_photos().map_err(|e| e.to_string())
}

/// Starred photos.
#[tauri::command]
fn list_starred(state: State<'_, LibState>) -> Result<Vec<PhotoDto>, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.db().starred_photos().map_err(|e| e.to_string())
}

/// All day notes.
#[tauri::command]
fn list_notes(state: State<'_, LibState>) -> Result<Vec<NoteDto>, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.db().all_notes().map_err(|e| e.to_string())
}

/// Per-date photo counts for a year (for the heatmap).
#[tauri::command]
fn year_counts(year: i32, state: State<'_, LibState>) -> Result<Vec<DayCountDto>, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.db().year_counts(year).map_err(|e| e.to_string())
}

/// Per-day records for a year-month (for the calendar).
#[tauri::command]
fn month_records(
    year: i32,
    month: u32,
    state: State<'_, LibState>,
) -> Result<Vec<MonthRecordDto>, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.db()
        .month_records(year, month)
        .map_err(|e| e.to_string())
}

/// List of watched folders.
#[tauri::command]
fn list_folders(state: State<'_, LibState>) -> Result<Vec<FolderDto>, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.db().list_folders().map_err(|e| e.to_string())
}

/// Place facets (for search).
#[tauri::command]
fn place_facets(state: State<'_, LibState>) -> Result<Vec<PlaceFacetDto>, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.db().place_facets().map_err(|e| e.to_string())
}

/// Library statistics.
#[tauri::command]
fn get_stats(state: State<'_, LibState>) -> Result<StatsDto, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.stats_full().map_err(|e| e.to_string())
}

/// Saves a day's note.
#[tauri::command]
fn save_note(date: String, note: String, state: State<'_, LibState>) -> Result<(), String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.save_note(&date, &note).map_err(|e| e.to_string())
}

/// Toggles a photo's star and returns the new state.
#[tauri::command]
fn toggle_star(photo_id: i64, state: State<'_, LibState>) -> Result<bool, String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.toggle_star(photo_id).map_err(|e| e.to_string())
}

/// Saves a photo's caption.
#[tauri::command]
fn set_caption(photo_id: i64, caption: String, state: State<'_, LibState>) -> Result<(), String> {
    let lib = state.lock().map_err(|e| e.to_string())?;
    lib.db()
        .set_caption(photo_id, &caption)
        .map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Set up the DB and library storage under the app data directory.
            let dir = app.path().app_data_dir()?;
            let lib = Library::open(&dir)?;
            app.manage(Mutex::new(lib));
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
            toggle_star,
            set_caption
        ])
        .run(tauri::generate_context!())
        .expect("error while running photo-diary");
}
