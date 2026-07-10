use serde::{Deserialize, Serialize};

/// Metadata extracted from EXIF.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PhotoMeta {
    /// Capture datetime, ISO 8601 local ("2026-07-04T16:42:00"). None if absent from EXIF.
    pub taken_at: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub width: u32,
    pub height: u32,
}

/// Result of an AVIF conversion.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AvifInfo {
    pub bytes: u64,
    pub width: u32,
    pub height: u32,
}

/// A new photo to insert into the DB.
#[derive(Debug, Clone)]
pub struct NewPhoto {
    pub store_path: String,
    pub store_bytes: i64,
    pub thumb_path: Option<String>,
    pub taken_at: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub width: u32,
    pub height: u32,
    pub original_filename: String,
    pub original_hash: String,
    pub place: Option<String>,
    /// Import timestamp (ISO)
    pub imported_at: String,
}

/// A `photos` row from the DB.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PhotoRow {
    pub id: i64,
    pub store_path: String,
    pub store_bytes: i64,
    pub thumb_path: Option<String>,
    pub taken_at: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub width: u32,
    pub height: u32,
    pub original_filename: String,
    pub original_hash: String,
    pub place: Option<String>,
    pub starred: bool,
    pub caption: Option<String>,
    pub imported_at: String,
}

/// Library statistics.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Stats {
    pub used_bytes: i64,
    pub photo_count: i64,
    pub day_count: i64,
    pub starred_count: i64,
}
