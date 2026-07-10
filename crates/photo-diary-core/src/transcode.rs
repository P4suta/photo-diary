use crate::model::AvifInfo;
use crate::Result;
use std::path::Path;

/// Decodes `src` and re-encodes it to AVIF (visually lossless) at **full resolution**,
/// saving to `dst`.
/// - `quality`: 0.0..=100.0 (ravif quality; visually lossless is roughly 80-90).
/// - Dimensions are not reduced (keeps the original resolution).
/// - Returns the saved byte count and dimensions.
///
/// Contract: do not change this public signature (core of internal library storage).
pub fn to_avif(src: &Path, dst: &Path, quality: f32) -> Result<AvifInfo> {
    let img = image::open(src)?.into_rgba8();
    let (w, h) = img.dimensions();

    let pixels: Vec<rgb::RGBA8> = img
        .pixels()
        .map(|p| rgb::RGBA8::new(p[0], p[1], p[2], p[3]))
        .collect();
    let ir = imgref::Img::new(pixels, w as usize, h as usize);

    let enc = ravif::Encoder::new().with_quality(quality).with_speed(6);
    let out = enc
        .encode_rgba(ir.as_ref())
        .map_err(|e| crate::Error::Avif(e.to_string()))?;

    std::fs::write(dst, &out.avif_file)?;

    Ok(AvifInfo {
        bytes: out.avif_file.len() as u64,
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

        let info = to_avif(&src, &dst, 80.0).expect("to_avif");

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

        let info = to_avif(&src, &dst, 80.0).expect("to_avif");

        assert_eq!(info.width, 24);
        assert_eq!(info.height, 8);
        assert!(info.bytes > 0);
        assert!(dst.exists());
    }

    #[test]
    fn to_avif_missing_source_is_err() {
        let dir = tempfile::tempdir().expect("tempdir");
        let src = dir.path().join("does-not-exist.png");
        let dst = dir.path().join("out.avif");

        let res = to_avif(&src, &dst, 80.0);
        assert!(res.is_err(), "missing source should be an error");
        assert!(!dst.exists(), "no output written on failure");
    }
}
