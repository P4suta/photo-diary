//! Core layer of photo-diary. Pure Rust for EXIF reading, folder scanning, thumbnail
//! generation, AVIF conversion, and SQLite. Independent of Tauri and unit-testable
//! (a cross-language "domain layer" corresponding to the frontend's `src/domain`).

pub mod db;
pub mod dto;
pub mod error;
pub mod exif;
pub mod library;
pub mod model;
pub mod orient;
pub mod scan;
pub mod thumbnail;
pub mod transcode;
pub mod views;

pub use error::{Error, Result};
pub use library::{ImportFailure, ImportProgress, ImportSummary, Library};
