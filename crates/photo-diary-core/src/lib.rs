//! Core layer of photo-diary. Pure Rust for EXIF reading, folder scanning, thumbnail
//! generation, AVIF conversion, and SQLite. Independent of Tauri and unit-testable
//! (a cross-language "domain layer" corresponding to the frontend's `src/domain`).

mod avif_decode;
pub mod db;
pub mod dto;
pub mod error;
pub mod exif;
pub mod jobs;
pub mod library;
pub mod model;
pub mod orient;
pub mod place;
pub mod scan;
pub mod thumbnail;
pub mod transcode;
pub mod views;
pub mod watch;

pub use error::{Error, Result};
pub use jobs::{JobManager, JobState};
pub use library::{CacheSummary, ImportFailure, ImportProgress, ImportSummary, Library};
pub use place::{OfflinePlaceResolver, PlaceResolver, PLACE_RESOLVER_VERSION};
pub use watch::{FolderFingerprint, FolderMonitor};
