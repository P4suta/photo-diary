use crate::Result;
use std::path::{Path, PathBuf};
use walkdir::{DirEntry, WalkDir};

/// Image extensions we can actually decode (compared in lowercase). The `image` crate
/// cannot decode heic/heif/avif (ravif is encode-only), so those are deliberately excluded
/// here and reported separately as unsupported rather than attempted and failed.
pub const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp", "tif", "tiff", "bmp", "gif"];

/// Extensions of images we recognize but cannot decode. Counted so the import can tell the
/// user why some files were left behind (instead of silently dropping them).
pub const UNSUPPORTED_EXTS: &[&str] = &["heic", "heif", "avif"];

/// Result of a folder scan.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ScanResult {
    /// Decodable image files, in traversal order (caller may sort).
    pub images: Vec<PathBuf>,
    /// Recognized-but-undecodable images (heic/heif/avif) that were skipped.
    pub unsupported: Vec<PathBuf>,
    /// Traversal errors (e.g. permission denied) surfaced instead of silently dropped.
    pub walk_errors: Vec<String>,
}

/// Recursively scans under `root`, classifying files by extension (case-insensitive).
/// Files and directories whose name starts with `.` are skipped entirely: dotfiles,
/// cache dirs like `.thumbnails`, and AppleDouble sidecars (`._name.jpg`). Traversal
/// errors are collected rather than dropped.
///
/// Contract: returns a [`ScanResult`]; the caller decides how to report each bucket.
pub fn scan(root: &Path) -> Result<ScanResult> {
    let mut result = ScanResult::default();

    // Prune hidden entries (but never the root itself, so a user may pick a dot-named folder).
    let walker = WalkDir::new(root)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !is_hidden(e));

    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(err) => {
                result.walk_errors.push(err.to_string());
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        match ext_lower(path).as_deref() {
            Some(ext) if IMAGE_EXTS.contains(&ext) => result.images.push(path.to_path_buf()),
            Some(ext) if UNSUPPORTED_EXTS.contains(&ext) => {
                result.unsupported.push(path.to_path_buf())
            }
            _ => {}
        }
    }

    Ok(result)
}

/// True if the entry's file name starts with `.` (dotfile, dot-directory, or AppleDouble `._`).
fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

/// Lowercased file extension, if any.
fn ext_lower(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
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

        let mut found = scan(root).unwrap().images;
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
    fn empty_dir_returns_empty_result() {
        let dir = tempfile::tempdir().unwrap();
        let result = scan(dir.path()).unwrap();
        assert!(result.images.is_empty());
        assert!(result.unsupported.is_empty());
        assert!(result.walk_errors.is_empty());
    }

    #[test]
    fn file_without_extension_is_ignored() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        touch(&root.join("README")); // no extension
        touch(&root.join("photo.jpeg"));

        let found = scan(root).unwrap().images;
        assert_eq!(found.len(), 1);
        assert_eq!(found[0], root.join("photo.jpeg"));
    }

    #[test]
    fn undecodable_formats_are_counted_as_unsupported() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        touch(&root.join("good.jpg"));
        touch(&root.join("phone.HEIC")); // case-insensitive
        touch(&root.join("clip.avif"));

        let result = scan(root).unwrap();
        assert_eq!(result.images.len(), 1);
        assert_eq!(result.unsupported.len(), 2, "heic + avif are unsupported");
    }

    #[test]
    fn skips_dotfiles_appledouble_and_dot_directories() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        touch(&root.join("keep.jpg"));
        touch(&root.join(".hidden.jpg")); // dotfile
        touch(&root.join("._keep.jpg")); // AppleDouble sidecar
        touch(&root.join(".thumbnails").join("cache.jpg")); // dot-directory cache

        let found = scan(root).unwrap().images;
        assert_eq!(found.len(), 1, "only keep.jpg survives: {found:?}");
        assert_eq!(found[0], root.join("keep.jpg"));
    }
}
