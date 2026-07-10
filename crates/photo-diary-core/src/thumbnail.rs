use crate::Result;
use std::path::Path;

/// Decodes `src` and saves a thumbnail to `dst` with its long edge within `max_edge`.
/// - Aspect ratio is preserved. Does not upscale if the original long edge is <= `max_edge`.
/// - Output format is determined by `dst`'s extension (webp recommended).
/// - Returns the (width, height) of the generated thumbnail.
///
/// Contract: do not change this public signature.
pub fn make_thumbnail(src: &Path, dst: &Path, max_edge: u32) -> Result<(u32, u32)> {
    let img = image::open(src)?;
    let (w, h) = (img.width(), img.height());
    let t = if w.max(h) <= max_edge {
        img
    } else {
        img.thumbnail(max_edge, max_edge)
    };
    t.save(dst)?;
    Ok((t.width(), t.height()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::RgbImage;
    use tempfile::tempdir;

    #[test]
    fn shrinks_landscape_keeping_aspect_and_writes_dst() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src.png");
        let dst = dir.path().join("dst.png");

        let input = RgbImage::from_fn(100, 40, |x, _y| image::Rgb([(x % 256) as u8, 0, 0]));
        input.save(&src).unwrap();

        let (tw, th) = make_thumbnail(&src, &dst, 50).unwrap();

        assert!(tw.max(th) <= 50, "long edge exceeded max_edge: {tw}x{th}");
        // Aspect preserved: 100:40 == 5:2 -> 50:20.
        assert_eq!((tw, th), (50, 20));
        assert!(dst.exists());
        // The saved file decodes at the correct dimensions.
        let out = image::open(&dst).unwrap();
        assert_eq!((out.width(), out.height()), (50, 20));
    }

    #[test]
    fn does_not_upscale_when_already_small() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("small.png");
        let dst = dir.path().join("small_out.png");

        // 30x10 is <= max_edge=50, so no upscaling.
        let input = RgbImage::from_fn(30, 10, |_x, _y| image::Rgb([0, 128, 0]));
        input.save(&src).unwrap();

        let (tw, th) = make_thumbnail(&src, &dst, 50).unwrap();

        assert_eq!((tw, th), (30, 10));
        assert!(dst.exists());
    }

    #[test]
    fn shrinks_portrait_keeping_aspect() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("tall.png");
        let dst = dir.path().join("tall_out.png");

        // 40x100 (portrait) -> long edge 100 down to 50.
        let input = RgbImage::from_fn(40, 100, |_x, y| image::Rgb([0, 0, (y % 256) as u8]));
        input.save(&src).unwrap();

        let (tw, th) = make_thumbnail(&src, &dst, 50).unwrap();

        assert!(tw.max(th) <= 50, "long edge exceeded max_edge: {tw}x{th}");
        assert_eq!((tw, th), (20, 50));
        assert!(dst.exists());
    }
}
