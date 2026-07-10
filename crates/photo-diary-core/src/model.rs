use serde::{Deserialize, Serialize};

/// Metadata extracted from EXIF.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PhotoMeta {
    /// Capture datetime, ISO 8601 local ("2026-07-04T16:42:00"). None if absent from EXIF.
    pub taken_at: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    /// Raw (pre-orientation) pixel dimensions from decode. The stored dimensions are taken
    /// post-orientation from the AVIF conversion; don't rely on these for display sizing.
    pub width: u32,
    pub height: u32,
    /// EXIF Orientation tag (1-8; 1 if absent). Applied to pixels before encoding.
    pub orientation: u16,
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
    /// Path to the AVIF master, **relative to the data dir** (e.g. `library/abc.avif`).
    pub store_path: String,
    pub store_bytes: i64,
    /// Path to the thumbnail, **relative to the data dir** (e.g. `thumbnails/abc.webp`).
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
    /// Owning watched folder's id (`folders.id`). None if unknown.
    pub folder_id: Option<i64>,
}

/// A `folders` row joined with its photo count (raw data; the fs-derived status is added by
/// the Library layer, which keeps the Db fs-free).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderRow {
    pub id: i64,
    pub path: String,
    /// Last time this folder was scanned/imported (ISO local). Empty if never.
    pub last_scan: String,
    /// Number of photos imported from this folder (JOIN on `photos.folder_id`).
    pub photo_count: i64,
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
