use crate::{Error, Result};
use image::{DynamicImage, RgbImage, RgbaImage};
use std::fs;
use std::path::Path;
use zenavif::{DecoderConfig, Unstoppable};

/// Decodes an AVIF created by photo-diary for internal cache recovery.
///
/// This boundary is deliberately private: AVIF remains a detected-and-skipped input format.
/// `prefer_8bit` produces exactly the channel depth needed by the WebP thumbnail encoder, while
/// the pixel limit prevents a damaged internal file from requesting an unbounded frame.
pub(crate) fn decode_internal_master(path: &Path) -> Result<DynamicImage> {
    let bytes = fs::read(path)?;
    let config = DecoderConfig::new()
        .prefer_8bit(true)
        .apply_grain(false)
        .frame_size_limit(200_000_000);
    let pixels = zenavif::decode_with(&bytes, &config, &Unstoppable)
        .map_err(|error| Error::AvifDecode(error.to_string()))?;
    let width = pixels.width();
    let height = pixels.height();
    let channels = pixels.descriptor().bytes_per_pixel();
    let bytes = pixels.copy_to_contiguous_bytes();

    match channels {
        3 => RgbImage::from_raw(width, height, bytes)
            .map(DynamicImage::ImageRgb8)
            .ok_or_else(|| Error::AvifDecode("invalid RGB8 buffer dimensions".to_string())),
        4 => RgbaImage::from_raw(width, height, bytes)
            .map(DynamicImage::ImageRgba8)
            .ok_or_else(|| Error::AvifDecode("invalid RGBA8 buffer dimensions".to_string())),
        other => Err(Error::AvifDecode(format!(
            "unsupported decoded pixel width: {other} bytes"
        ))),
    }
}
