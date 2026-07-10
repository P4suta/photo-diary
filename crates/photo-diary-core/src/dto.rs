//! Raw-data DTOs passed to the frontend (`PhotoLibrary` port). serde is camelCase.
//! Presentation (day grouping / heatmap / calendar / highlights) is built by pure
//! functions on the TS side (`src/domain/build`). Here we only convert DB -> plain shapes.

use crate::model::PhotoRow;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoDto {
    pub id: String,
    /// '4/3' | '3/4' | '1/1' (derived from dimensions)
    pub aspect: String,
    pub taken_at: String,
    pub place: Option<String>,
    pub starred: bool,
    pub caption: Option<String>,
    pub width: u32,
    pub height: u32,
    pub megapixels: f64,
    /// Absolute file path of the display thumbnail (frontend: convertFileSrc -> thumbUrl).
    /// Stored relative in the DB; joined with the current data dir here.
    pub thumb_path: Option<String>,
    /// Absolute file path of the full-resolution AVIF master (frontend: convertFileSrc -> fullUrl,
    /// shown in the lightbox). Stored relative in the DB; joined with the current data dir here
    /// (same treatment as `thumb_path`). Never null — every photo has a stored master.
    pub store_path: String,
    pub size_bytes: i64,
    pub format: String,
    pub quality: String,
    pub original_filename: String,
    pub imported_at: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
}

impl PhotoDto {
    /// Builds a DTO from a DB row, resolving the DB-relative `thumb_path` against `data_dir`
    /// so the IPC surface carries an ABSOLUTE path (the frontend's convertFileSrc needs it).
    pub fn from_row(r: PhotoRow, data_dir: &Path) -> Self {
        let megapixels = ((r.width as f64 * r.height as f64) / 100_000.0).round() / 10.0;
        let thumb_path = r
            .thumb_path
            .map(|rel| data_dir.join(rel).to_string_lossy().into_owned());
        let store_path = data_dir.join(r.store_path).to_string_lossy().into_owned();
        PhotoDto {
            id: r.id.to_string(),
            aspect: aspect_of(r.width, r.height),
            taken_at: r.taken_at,
            place: r.place,
            starred: r.starred,
            caption: r.caption,
            width: r.width,
            height: r.height,
            megapixels,
            thumb_path,
            store_path,
            size_bytes: r.store_bytes,
            format: "AVIF".to_string(),
            quality: "Visually lossless".to_string(),
            original_filename: r.original_filename,
            imported_at: r.imported_at,
            lat: r.lat,
            lng: r.lng,
        }
    }
}

/// Picks the aspect kind from the dimension ratio (matches the frontend tile layout).
fn aspect_of(w: u32, h: u32) -> String {
    if h == 0 {
        return "1/1".to_string();
    }
    let r = w as f64 / h as f64;
    let a = if r > 1.15 {
        "4/3"
    } else if r < 0.87 {
        "3/4"
    } else {
        "1/1"
    };
    a.to_string()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteDto {
    pub date: String,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayCountDto {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthRecordDto {
    pub day: i64,
    pub count: i64,
    pub has_note: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderDto {
    pub id: String,
    pub path: String,
    pub status: String,
    pub last_scan: String,
    pub photo_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceFacetDto {
    pub label: String,
    pub count: i64,
    pub selected: bool,
    pub muted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsDto {
    pub used_bytes: i64,
    pub photo_count: i64,
    pub day_count: i64,
    pub starred_count: i64,
    pub thumbnail_cache_bytes: i64,
    pub location: String,
    pub last_import: String,
}
