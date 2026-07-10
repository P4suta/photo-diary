//! Shared EXIF-orientation helper. Applied to decoded pixels once, before both the AVIF
//! master and the thumbnail are produced, so photos are stored upright (portrait shots are
//! no longer archived sideways).

use image::DynamicImage;

/// Applies an EXIF `Orientation` value (1-8) to `img`, returning the upright image.
///
/// Note: `image::open` does not auto-apply EXIF orientation, so callers must rotate
/// explicitly. Values are per the EXIF spec (`rotate90` is clockwise):
/// - 1: no change
/// - 2: flip horizontal
/// - 3: rotate 180
/// - 4: flip vertical
/// - 5: transpose (rotate 90 CW then flip horizontal)
/// - 6: rotate 90 CW
/// - 7: transverse (rotate 90 CW then flip vertical)
/// - 8: rotate 270 CW
///
/// Unknown values are treated as 1 (identity).
pub fn apply_orientation(img: DynamicImage, orientation: u16) -> DynamicImage {
    match orientation {
        2 => img.fliph(),
        3 => img.rotate180(),
        4 => img.flipv(),
        5 => img.rotate90().fliph(),
        6 => img.rotate90(),
        7 => img.rotate90().flipv(),
        8 => img.rotate270(),
        _ => img,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    /// Builds a 2x3 image whose every pixel encodes its own coordinates as `[x, y, 0, 255]`.
    /// Asymmetric in both axes so rotations/flips are detectable.
    fn asymmetric() -> DynamicImage {
        let img = RgbaImage::from_fn(2, 3, |x, y| Rgba([x as u8, y as u8, 0, 255]));
        DynamicImage::ImageRgba8(img)
    }

    fn px(img: &DynamicImage, x: u32, y: u32) -> [u8; 4] {
        image::GenericImageView::get_pixel(img, x, y).0
    }

    #[test]
    fn orientation_2_flips_horizontal() {
        let out = apply_orientation(asymmetric(), 2);
        // Dimensions unchanged; (x,y) -> (W-1-x, y).
        assert_eq!((out.width(), out.height()), (2, 3));
        assert_eq!(px(&out, 1, 0), [0, 0, 0, 255]); // original (0,0)
        assert_eq!(px(&out, 0, 2), [1, 2, 0, 255]); // original (1,2)
    }

    #[test]
    fn orientation_3_rotates_180() {
        let out = apply_orientation(asymmetric(), 3);
        // Dimensions unchanged; (x,y) -> (W-1-x, H-1-y).
        assert_eq!((out.width(), out.height()), (2, 3));
        assert_eq!(px(&out, 1, 2), [0, 0, 0, 255]); // original (0,0)
        assert_eq!(px(&out, 0, 0), [1, 2, 0, 255]); // original (1,2)
    }

    #[test]
    fn orientation_6_rotates_90_cw() {
        let out = apply_orientation(asymmetric(), 6);
        // Dimensions swap to 3x2; (x,y) -> (H-1-y, x).
        assert_eq!((out.width(), out.height()), (3, 2));
        assert_eq!(px(&out, 2, 0), [0, 0, 0, 255]); // original (0,0)
        assert_eq!(px(&out, 0, 1), [1, 2, 0, 255]); // original (1,2)
    }

    #[test]
    fn orientation_5_transposes() {
        let out = apply_orientation(asymmetric(), 5);
        // Transpose swaps axes: (x,y) -> (y,x), dimensions become 3x2.
        assert_eq!((out.width(), out.height()), (3, 2));
        assert_eq!(px(&out, 0, 0), [0, 0, 0, 255]); // original (0,0)
        assert_eq!(px(&out, 2, 1), [1, 2, 0, 255]); // original (1,2)
    }

    #[test]
    fn orientation_1_and_unknown_are_identity() {
        let out = apply_orientation(asymmetric(), 1);
        assert_eq!((out.width(), out.height()), (2, 3));
        assert_eq!(px(&out, 1, 2), [1, 2, 0, 255]);

        let out99 = apply_orientation(asymmetric(), 99);
        assert_eq!(px(&out99, 1, 2), [1, 2, 0, 255]);
    }
}
