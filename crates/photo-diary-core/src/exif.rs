use crate::model::PhotoMeta;
use crate::Result;
use exif::{In, Reader, Tag, Value};
use std::path::Path;

/// Reads EXIF capture datetime, GPS, and dimensions from an image.
/// - Capture datetime: `DateTimeOriginal` (or `DateTime` if absent) converted from
///   `YYYY:MM:DD HH:MM:SS` to ISO 8601 local `YYYY-MM-DDTHH:MM:SS`. `None` if absent.
/// - GPS: `GPSLatitude`/`GPSLongitude` from DMS + Ref (N/S/E/W) to decimal degrees.
/// - Dimensions: EXIF Pixel(X|Y)Dimension, or from image decode if absent.
///
/// Contract: do not change this public signature (the Tauri command layer depends on it).
pub fn read_meta(path: &Path) -> Result<PhotoMeta> {
    // The source of truth for dimensions is the actual pixel decode; don't trust EXIF dimension tags.
    let (width, height) = image::image_dimensions(path)?;

    let (mut taken_at, mut lat, mut lng) = (None, None, None);
    let mut orientation = 1u16;

    // EXIF is often missing/corrupt, so still return dimensions even if it fails.
    let file = std::fs::File::open(path)?;
    let mut buf = std::io::BufReader::new(&file);
    if let Ok(ex) = Reader::new().read_from_container(&mut buf) {
        // Capture datetime: prefer DateTimeOriginal, fall back to DateTime.
        let raw_dt = ex
            .get_field(Tag::DateTimeOriginal, In::PRIMARY)
            .or_else(|| ex.get_field(Tag::DateTime, In::PRIMARY))
            .and_then(|f| ascii_first(&f.value));
        if let Some(raw) = raw_dt {
            taken_at = parse_exif_datetime(&raw);
        }

        // GPS latitude/longitude (latitude bounded to +-90, longitude to +-180).
        lat = read_gps(&ex, Tag::GPSLatitude, Tag::GPSLatitudeRef, b'S', 90.0);
        lng = read_gps(&ex, Tag::GPSLongitude, Tag::GPSLongitudeRef, b'W', 180.0);

        // Orientation tag (1-8). Absent/unreadable -> 1 (upright).
        if let Some(v) = ex
            .get_field(Tag::Orientation, In::PRIMARY)
            .and_then(|f| f.value.get_uint(0))
        {
            orientation = v as u16;
        }
    }

    Ok(PhotoMeta {
        taken_at,
        lat,
        lng,
        width,
        height,
        orientation,
    })
}

/// Extracts the first element of `Value::Ascii` as a UTF-8 string.
fn ascii_first(value: &Value) -> Option<String> {
    match value {
        Value::Ascii(vecs) => vecs
            .first()
            .and_then(|bytes| std::str::from_utf8(bytes).ok())
            .map(|s| s.trim_matches(char::from(0)).trim().to_string()),
        _ => None,
    }
}

/// Pure function converting an EXIF datetime string `"YYYY:MM:DD HH:MM:SS"` to
/// ISO 8601 local `"YYYY-MM-DDTHH:MM:SS"`.
///
/// Returns `None` if the format is unexpected. No timezone is attached (treated as local time).
fn parse_exif_datetime(raw: &str) -> Option<String> {
    let raw = raw.trim().trim_matches(char::from(0)).trim();
    // Expected: "YYYY:MM:DD HH:MM:SS"
    let (date_part, time_part) = raw.split_once(' ')?;

    let date: Vec<&str> = date_part.split(':').collect();
    if date.len() != 3 {
        return None;
    }
    let time: Vec<&str> = time_part.split(':').collect();
    if time.len() != 3 {
        return None;
    }

    // Ensure each component is numeric (rejects unset values like "    :  :  ").
    for part in date.iter().chain(time.iter()) {
        if part.is_empty() || !part.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
    }

    Some(format!(
        "{}-{}-{}T{}:{}:{}",
        date[0], date[1], date[2], time[0], time[1], time[2]
    ))
}

/// Converts a GPS coordinate from DMS + directional reference to decimal degrees.
///
/// `neg_ref` is the single byte for the direction that should be negative (latitude `b'S'`, longitude `b'W'`).
/// `max_abs` bounds the valid magnitude (90 for latitude, 180 for longitude).
fn read_gps(
    ex: &exif::Exif,
    coord_tag: Tag,
    ref_tag: Tag,
    neg_ref: u8,
    max_abs: f64,
) -> Option<f64> {
    let coord = ex.get_field(coord_tag, In::PRIMARY)?;
    let dms = match &coord.value {
        Value::Rational(r) => r.as_slice(),
        _ => return None,
    };

    let is_negative = ex
        .get_field(ref_tag, In::PRIMARY)
        .and_then(|field| ascii_first(&field.value))
        .and_then(|r| r.bytes().next())
        .map(|b| b.eq_ignore_ascii_case(&neg_ref))
        == Some(true);

    dms_to_decimal(dms, is_negative, max_abs)
}

/// Pure DMS-to-decimal conversion with sanity guards. Returns `None` for malformed input:
/// wrong arity, zero-denominator rationals, non-finite results, or magnitudes exceeding
/// `max_abs`. Kept separate from EXIF access so it can be unit-tested directly.
fn dms_to_decimal(dms: &[exif::Rational], is_negative: bool, max_abs: f64) -> Option<f64> {
    if dms.len() != 3 {
        return None;
    }
    // A zero denominator would yield inf/NaN; reject rather than store garbage coordinates.
    if dms.iter().any(|r| r.denom == 0) {
        return None;
    }

    let decimal = dms[0].to_f64() + dms[1].to_f64() / 60.0 + dms[2].to_f64() / 3600.0;
    if !decimal.is_finite() || decimal > max_abs {
        return None;
    }

    Some(if is_negative { -decimal } else { decimal })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};
    use std::path::PathBuf;

    /// Synthesizes a solid-color PNG of the given size in tempdir and returns its path.
    fn write_png(dir: &Path, name: &str, w: u32, h: u32) -> PathBuf {
        let mut img = RgbImage::new(w, h);
        for px in img.pixels_mut() {
            *px = Rgb([10, 20, 30]);
        }
        let path = dir.join(name);
        img.save(&path).expect("save png");
        path
    }

    #[test]
    fn reads_dimensions_from_exifless_png() {
        let dir = tempfile::tempdir().unwrap();
        let path = write_png(dir.path(), "a.png", 37, 19);

        let meta = read_meta(&path).unwrap();
        assert_eq!(meta.width, 37);
        assert_eq!(meta.height, 19);
    }

    #[test]
    fn exifless_png_has_no_taken_at_or_gps() {
        let dir = tempfile::tempdir().unwrap();
        let path = write_png(dir.path(), "b.png", 8, 8);

        let meta = read_meta(&path).unwrap();
        assert_eq!(meta.taken_at, None);
        assert_eq!(meta.lat, None);
        assert_eq!(meta.lng, None);
        // Absent Orientation tag defaults to 1 (upright); locks the field against refactors.
        assert_eq!(meta.orientation, 1);
    }

    #[test]
    fn dimensions_are_from_pixels_not_square_assumption() {
        let dir = tempfile::tempdir().unwrap();
        // Non-square to catch width/height being swapped.
        let path = write_png(dir.path(), "wide.png", 64, 16);

        let meta = read_meta(&path).unwrap();
        assert_eq!(meta.width, 64);
        assert_eq!(meta.height, 16);
    }

    #[test]
    fn missing_file_is_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("does-not-exist.png");
        assert!(read_meta(&path).is_err());
    }

    #[test]
    fn parse_datetime_happy_path() {
        assert_eq!(
            parse_exif_datetime("2026:07:04 16:42:00").as_deref(),
            Some("2026-07-04T16:42:00")
        );
    }

    #[test]
    fn parse_datetime_trims_null_and_whitespace() {
        assert_eq!(
            parse_exif_datetime("  2001:01:02 03:04:05\0 ").as_deref(),
            Some("2001-01-02T03:04:05")
        );
    }

    fn r(num: u32, denom: u32) -> exif::Rational {
        exif::Rational { num, denom }
    }

    #[test]
    fn dms_rejects_zero_denominator() {
        // 35 / 0 deg -> would be inf; must be rejected, not stored.
        let dms = [r(35, 0), r(41, 1), r(0, 1)];
        assert_eq!(dms_to_decimal(&dms, false, 90.0), None);
    }

    #[test]
    fn dms_converts_and_negates() {
        // 35 deg 30 min 0 sec = 35.5; negated for S/W.
        let dms = [r(35, 1), r(30, 1), r(0, 1)];
        assert_eq!(dms_to_decimal(&dms, false, 90.0), Some(35.5));
        assert_eq!(dms_to_decimal(&dms, true, 90.0), Some(-35.5));
    }

    #[test]
    fn dms_rejects_out_of_range_and_wrong_arity() {
        // Latitude beyond +-90.
        assert_eq!(
            dms_to_decimal(&[r(200, 1), r(0, 1), r(0, 1)], false, 90.0),
            None
        );
        // Not exactly three components.
        assert_eq!(dms_to_decimal(&[r(35, 1), r(30, 1)], false, 90.0), None);
    }

    #[test]
    fn parse_datetime_rejects_malformed() {
        // Unset values, missing separators, and non-numeric all yield None.
        assert_eq!(parse_exif_datetime("    :  :     :  :  "), None);
        assert_eq!(parse_exif_datetime("2026-07-04 16:42:00"), None);
        assert_eq!(parse_exif_datetime("2026:07:04"), None);
        assert_eq!(parse_exif_datetime("2026:07:04 16:42"), None);
        assert_eq!(parse_exif_datetime("abcd:07:04 16:42:00"), None);
        assert_eq!(parse_exif_datetime(""), None);
    }
}
