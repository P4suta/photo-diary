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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::PhotoRow;
    use serde_json::Value;
    use std::collections::BTreeSet;

    /// The set of top-level JSON object keys.
    fn keys(v: &Value) -> BTreeSet<String> {
        v.as_object().unwrap().keys().cloned().collect()
    }

    /// A literal expected key set (compared for equality, so an extra OR missing key fails).
    fn expect(list: &[&str]) -> BTreeSet<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    /// A fully-populated `PhotoRow` with the given dimensions (drives aspect/megapixels).
    fn row(width: u32, height: u32) -> PhotoRow {
        PhotoRow {
            id: 1,
            store_path: "library/abc.avif".into(),
            store_bytes: 12_345,
            thumb_path: Some("thumbnails/abc.webp".into()),
            taken_at: "2026-07-04T16:42:00".into(),
            lat: Some(35.0),
            lng: Some(139.0),
            width,
            height,
            original_filename: "abc.jpg".into(),
            original_hash: "deadbeef".into(),
            place: Some("Tokyo".into()),
            starred: true,
            caption: Some("nice".into()),
            imported_at: "2026-07-05T09:00:00".into(),
        }
    }

    /// A `PhotoRow` whose every Option field is None (for the null-representation test).
    fn row_all_none() -> PhotoRow {
        PhotoRow {
            thumb_path: None,
            lat: None,
            lng: None,
            place: None,
            caption: None,
            ..row(1920, 1080)
        }
    }

    fn dto(width: u32, height: u32) -> PhotoDto {
        PhotoDto::from_row(row(width, height), Path::new("/data"))
    }

    // --- Serde wire-contract tests: exact camelCase key sets the TS port depends on. ---

    #[test]
    fn photo_dto_serializes_exact_camelcase_keys() {
        let v = serde_json::to_value(dto(1920, 1080)).unwrap();
        assert_eq!(
            keys(&v),
            expect(&[
                "id",
                "aspect",
                "takenAt",
                "place",
                "starred",
                "caption",
                "width",
                "height",
                "megapixels",
                "thumbPath",
                "storePath",
                "sizeBytes",
                "format",
                "quality",
                "originalFilename",
                "importedAt",
                "lat",
                "lng",
            ])
        );
    }

    #[test]
    fn photo_dto_none_options_serialize_as_present_null_keys() {
        // A dropped key (e.g. from a later `skip_serializing_if`) would break the TS side that
        // reads `string | null`; assert the key is PRESENT and its value is JSON null.
        let v =
            serde_json::to_value(PhotoDto::from_row(row_all_none(), Path::new("/data"))).unwrap();
        for k in ["place", "caption", "thumbPath", "lat", "lng"] {
            assert!(v.get(k).is_some(), "{k} must remain a present key");
            assert!(v[k].is_null(), "{k} must serialize as null when None");
        }
        // storePath is never optional — always a string.
        assert!(v["storePath"].is_string());
    }

    #[test]
    fn note_dto_serializes_exact_keys() {
        let v = serde_json::to_value(NoteDto {
            date: "2026-07-04".into(),
            note: "hi".into(),
        })
        .unwrap();
        assert_eq!(keys(&v), expect(&["date", "note"]));
    }

    #[test]
    fn day_count_dto_serializes_exact_keys() {
        let v = serde_json::to_value(DayCountDto {
            date: "2026-07-04".into(),
            count: 3,
        })
        .unwrap();
        assert_eq!(keys(&v), expect(&["date", "count"]));
    }

    #[test]
    fn month_record_dto_serializes_exact_keys() {
        let v = serde_json::to_value(MonthRecordDto {
            day: 4,
            count: 2,
            has_note: true,
        })
        .unwrap();
        assert_eq!(keys(&v), expect(&["day", "count", "hasNote"]));
    }

    #[test]
    fn folder_dto_serializes_exact_keys() {
        let v = serde_json::to_value(FolderDto {
            id: "1".into(),
            path: "/photos".into(),
            status: "watching".into(),
            last_scan: "2026-07-04T10:00:00".into(),
            photo_count: 12,
        })
        .unwrap();
        assert_eq!(
            keys(&v),
            expect(&["id", "path", "status", "lastScan", "photoCount"])
        );
    }

    #[test]
    fn place_facet_dto_serializes_exact_keys() {
        let v = serde_json::to_value(PlaceFacetDto {
            label: "Tokyo".into(),
            count: 5,
            selected: false,
            muted: false,
        })
        .unwrap();
        assert_eq!(keys(&v), expect(&["label", "count", "selected", "muted"]));
    }

    #[test]
    fn stats_dto_serializes_exact_keys() {
        let v = serde_json::to_value(StatsDto {
            used_bytes: 1,
            photo_count: 2,
            day_count: 3,
            starred_count: 4,
            thumbnail_cache_bytes: 5,
            location: "/lib".into(),
            last_import: "2026-07-04T10:00:00".into(),
        })
        .unwrap();
        assert_eq!(
            keys(&v),
            expect(&[
                "usedBytes",
                "photoCount",
                "dayCount",
                "starredCount",
                "thumbnailCacheBytes",
                "location",
                "lastImport",
            ])
        );
    }

    // --- Derived-field logic: aspect classification + megapixels rounding. ---

    #[test]
    fn aspect_classifies_landscape_portrait_square() {
        assert_eq!(dto(1920, 1080).aspect, "4/3", "wide landscape");
        assert_eq!(dto(1080, 1920).aspect, "3/4", "tall portrait");
        assert_eq!(dto(1000, 1000).aspect, "1/1", "square");
    }

    #[test]
    fn aspect_boundaries_are_inclusive_of_square() {
        // Upper threshold: r > 1.15 tips to 4/3; exactly 1.15 stays square.
        assert_eq!(dto(115, 100).aspect, "1/1", "r == 1.15 is square");
        assert_eq!(dto(116, 100).aspect, "4/3", "r == 1.16 is landscape");
        // Lower threshold: r < 0.87 tips to 3/4; exactly 0.87 stays square.
        assert_eq!(dto(87, 100).aspect, "1/1", "r == 0.87 is square");
        assert_eq!(dto(86, 100).aspect, "3/4", "r == 0.86 is portrait");
    }

    #[test]
    fn aspect_guards_zero_height() {
        // A zero height would divide by zero; the guard returns square.
        assert_eq!(dto(100, 0).aspect, "1/1");
    }

    #[test]
    fn megapixels_round_to_one_decimal() {
        // 2_073_600 px -> 20.736 -> round 21 -> 2.1 MP.
        assert_eq!(dto(1920, 1080).megapixels, 2.1);
        // 12_000_000 px -> exactly 12.0 MP.
        assert_eq!(dto(4000, 3000).megapixels, 12.0);
        // Rounding: 1_050_000 px -> 10.5 -> rounds up to 11 -> 1.1 MP.
        assert_eq!(dto(1050, 1000).megapixels, 1.1);
        // Rounding: 1_040_000 px -> 10.4 -> rounds down to 10 -> 1.0 MP.
        assert_eq!(dto(1040, 1000).megapixels, 1.0);
        // Tiny images round down to 0.0 rather than a misleading fraction.
        assert_eq!(dto(1, 1).megapixels, 0.0);
    }

    #[test]
    fn from_row_joins_paths_against_the_data_dir() {
        // thumb_path (relative, Option) and store_path (relative, always present) are re-joined to
        // absolute under the data dir; the frontend's convertFileSrc needs absolute paths.
        let d = PhotoDto::from_row(row(1920, 1080), Path::new("/data"));
        assert!(Path::new(&d.store_path).is_absolute() || d.store_path.starts_with("/data"));
        assert!(d.store_path.ends_with("abc.avif"));
        let thumb = d.thumb_path.as_deref().unwrap();
        assert!(thumb.ends_with("abc.webp"));
        assert!(thumb.starts_with("/data") || Path::new(thumb).is_absolute());
    }
}
