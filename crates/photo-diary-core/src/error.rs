use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("image error: {0}")]
    Image(#[from] image::ImageError),
    #[error("exif error: {0}")]
    Exif(#[from] exif::Error),
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("avif encode error: {0}")]
    Avif(String),
    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
