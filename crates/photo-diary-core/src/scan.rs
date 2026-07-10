use crate::Result;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Supported image extensions (compared in lowercase).
pub const IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "heic", "heif", "tif", "tiff", "avif", "bmp", "gif",
];

/// Recursively scans under `root` and returns paths of supported image files.
/// Judged by extension (case-insensitive). Directory order need not be deterministic;
/// paths are returned as-is so the caller can sort.
///
/// Contract: do not change this public signature.
pub fn scan_images(root: &Path) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for entry in WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let is_image = path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_ascii_lowercase())
            .map(|ext| IMAGE_EXTS.contains(&ext.as_str()))
            .unwrap_or(false);
        if is_image {
            out.push(path.to_path_buf());
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Small helper that creates an empty file under `dir`.
    fn touch(path: &Path) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, b"").unwrap();
    }

    #[test]
    fn finds_images_recursively_and_ignores_non_images() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        touch(&root.join("a.jpg"));
        touch(&root.join("b.PNG")); // matches even with an uppercase extension
        touch(&root.join("c.txt")); // not an image
        touch(&root.join("sub").join("d.webp")); // subdirectory

        let mut found = scan_images(root).unwrap();
        found.sort();

        assert_eq!(
            found.len(),
            3,
            "only the 3 images should be returned: {found:?}"
        );
        assert!(found.iter().any(|p| p == &root.join("a.jpg")));
        assert!(found.iter().any(|p| p == &root.join("b.PNG")));
        assert!(found.iter().any(|p| p == &root.join("sub").join("d.webp")));
        assert!(
            !found.iter().any(|p| p == &root.join("c.txt")),
            "non-image c.txt must not be included"
        );
    }

    #[test]
    fn empty_dir_returns_empty_vec() {
        let dir = tempfile::tempdir().unwrap();
        let found = scan_images(dir.path()).unwrap();
        assert!(found.is_empty());
    }

    #[test]
    fn file_without_extension_is_ignored() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        touch(&root.join("README")); // no extension
        touch(&root.join("photo.jpeg"));

        let found = scan_images(root).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0], root.join("photo.jpeg"));
    }
}
