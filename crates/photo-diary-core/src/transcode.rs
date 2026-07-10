use crate::model::AvifInfo;
use crate::Result;
use image::codecs::avif::AvifEncoder;
use image::{DynamicImage, ImageEncoder};
use std::path::Path;

/// Encoder speed (0=slowest/smallest, 10=fastest). 6 balances encode time against size.
const AVIF_SPEED: u8 = 6;

/// Re-encodes an already-decoded (and orientation-corrected) image to AVIF (visually
/// lossless) at **full resolution**, saving to `dst`.
/// - `quality`: 0.0..=100.0 (image's AvifEncoder quality; visually lossless is roughly 80-90).
/// - Dimensions are not reduced (keeps the source resolution).
/// - Returns the saved byte count and dimensions.
///
/// Contract: takes a decoded `&DynamicImage` (the caller decodes and applies EXIF orientation
/// once, sharing the pixels with thumbnail generation) rather than a path. Encoding uses
/// image's own `AvifEncoder` (ravif/rav1e) so only one rav1e version is compiled.
pub fn to_avif(img: &DynamicImage, dst: &Path, quality: f32) -> Result<AvifInfo> {
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    // Encode into memory first so we can report the exact byte count and write atomically.
    let mut out: Vec<u8> = Vec::new();
    let quality = quality.round().clamp(1.0, 100.0) as u8;
    AvifEncoder::new_with_speed_quality(&mut out, AVIF_SPEED, quality)
        .write_image(rgba.as_raw(), w, h, image::ExtendedColorType::Rgba8)
        .map_err(|e| crate::Error::Avif(e.to_string()))?;

    std::fs::write(dst, &out)?;

    Ok(AvifInfo {
        bytes: out.len() as u64,
        width: w,
        height: h,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    /// Synthesizes a 16x16 RGBA image and saves it as a PNG at `path`.
    fn write_test_png(path: &Path) {
        let mut img = RgbaImage::new(16, 16);
        for (x, y, px) in img.enumerate_pixels_mut() {
            // Deterministic gradient-like pattern (no randomness/time dependency).
            let r = (x * 16) as u8;
            let g = (y * 16) as u8;
            let b = ((x + y) * 8) as u8;
            *px = Rgba([r, g, b, 255]);
        }
        img.save(path).expect("save test png");
    }

    #[test]
    fn to_avif_encodes_full_resolution() {
        let dir = tempfile::tempdir().expect("tempdir");
        let src = dir.path().join("src.png");
        let dst = dir.path().join("out.avif");

        write_test_png(&src);
        let img = image::open(&src).expect("open");

        let info = to_avif(&img, &dst, 80.0).expect("to_avif");

        assert_eq!(info.width, 16, "width preserved");
        assert_eq!(info.height, 16, "height preserved");
        assert!(info.bytes > 0, "encoded bytes should be non-empty");
        assert!(dst.exists(), "destination file should exist");

        let on_disk = std::fs::metadata(&dst).expect("dst metadata").len();
        assert_eq!(on_disk, info.bytes, "reported bytes match file size");
    }

    #[test]
    fn to_avif_preserves_non_square_dimensions() {
        let dir = tempfile::tempdir().expect("tempdir");
        let src = dir.path().join("wide.png");
        let dst = dir.path().join("wide.avif");

        // Non-square 24x8 image to confirm width/height aren't swapped.
        let mut img = RgbaImage::new(24, 8);
        for (x, _y, px) in img.enumerate_pixels_mut() {
            *px = Rgba([(x * 10) as u8, 128, 200, 255]);
        }
        img.save(&src).expect("save wide png");
        let decoded = image::open(&src).expect("open");

        let info = to_avif(&decoded, &dst, 80.0).expect("to_avif");

        assert_eq!(info.width, 24);
        assert_eq!(info.height, 8);
        assert!(info.bytes > 0);
        assert!(dst.exists());
    }

    #[test]
    fn to_avif_applies_source_orientation_via_caller() {
        // to_avif encodes exactly the pixels it is given: an oriented image yields
        // post-rotation dimensions. Here a 24x8 landscape rotated 90 becomes 8x24.
        let dir = tempfile::tempdir().expect("tempdir");
        let src = dir.path().join("landscape.png");
        let dst = dir.path().join("rotated.avif");

        let mut img = RgbaImage::new(24, 8);
        for (x, _y, px) in img.enumerate_pixels_mut() {
            *px = Rgba([(x * 10) as u8, 128, 200, 255]);
        }
        img.save(&src).expect("save png");

        let decoded = image::open(&src).expect("open");
        let oriented = crate::orient::apply_orientation(decoded, 6); // rotate 90 CW
        let info = to_avif(&oriented, &dst, 80.0).expect("to_avif");

        assert_eq!((info.width, info.height), (8, 24), "dims are post-rotation");
    }
}
