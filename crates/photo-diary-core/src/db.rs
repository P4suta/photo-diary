use crate::model::{NewPhoto, PhotoRow, Stats};
use crate::Result;
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::path::Path;

/// SQLite wrapper. Schema mirrors `src/domain` (frontend):
/// - `photos(id, store_path UNIQUE, store_bytes, thumb_path, taken_at, lat, lng,
///    width, height, original_filename, original_hash UNIQUE, place, starred, caption)`
/// - `day_notes(date PRIMARY KEY 'YYYY-MM-DD', note, updated_at)`
/// - `folders(id, path UNIQUE, added_at)`
/// - index on `substr(taken_at,1,10)` (for grouping by day)
pub struct Db {
    pub conn: Connection,
}

/// Schema definition (idempotent).
const SCHEMA: &str = "\
CREATE TABLE IF NOT EXISTS photos (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    store_path        TEXT    NOT NULL UNIQUE,
    store_bytes       INTEGER NOT NULL,
    thumb_path        TEXT,
    taken_at          TEXT    NOT NULL,
    lat               REAL,
    lng               REAL,
    width             INTEGER NOT NULL,
    height            INTEGER NOT NULL,
    original_filename TEXT    NOT NULL,
    original_hash     TEXT    NOT NULL UNIQUE,
    place             TEXT,
    imported_at       TEXT    NOT NULL DEFAULT '',
    starred           INTEGER NOT NULL DEFAULT 0,
    caption           TEXT
);
CREATE TABLE IF NOT EXISTS day_notes (
    date       TEXT PRIMARY KEY,
    note       TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS folders (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    path     TEXT NOT NULL UNIQUE,
    added_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photos_day
    ON photos (substr(taken_at, 1, 10));
";

impl Db {
    /// Internal helper that builds a migrated `Db`.
    fn from_conn(conn: Connection) -> Result<Self> {
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn })
    }

    /// Opens the file (creating it if absent) and applies migrations.
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        Self::from_conn(conn)
    }

    /// In-memory DB (for tests). Already migrated.
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        Self::from_conn(conn)
    }

    /// Registers a folder (returns its id if it already exists).
    pub fn upsert_folder(&self, path: &str) -> Result<i64> {
        // Already present: return its id without inserting again.
        if let Some(id) = self
            .conn
            .query_row("SELECT id FROM folders WHERE path = ?1", [path], |r| {
                r.get::<_, i64>(0)
            })
            .optional()?
        {
            return Ok(id);
        }
        self.conn.execute(
            "INSERT INTO folders (path, added_at) VALUES (?1, datetime('now'))",
            [path],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Whether a photo with this original_hash is already imported (incremental scan).
    pub fn photo_exists(&self, original_hash: &str) -> Result<bool> {
        let exists: i64 = self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM photos WHERE original_hash = ?1)",
            [original_hash],
            |r| r.get(0),
        )?;
        Ok(exists != 0)
    }

    /// Inserts a photo and returns its id.
    pub fn insert_photo(&self, p: &NewPhoto) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO photos (
                store_path, store_bytes, thumb_path, taken_at, lat, lng,
                width, height, original_filename, original_hash, place, imported_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                p.store_path,
                p.store_bytes,
                p.thumb_path,
                p.taken_at,
                p.lat,
                p.lng,
                p.width as i64,
                p.height as i64,
                p.original_filename,
                p.original_hash,
                p.place,
                p.imported_at,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Upserts the note for a date ('YYYY-MM-DD').
    pub fn set_note(&self, date: &str, note: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO day_notes (date, note, updated_at)
             VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(date) DO UPDATE SET
                note = excluded.note,
                updated_at = excluded.updated_at",
            params![date, note],
        )?;
        Ok(())
    }

    pub fn get_note(&self, date: &str) -> Result<Option<String>> {
        let note = self
            .conn
            .query_row("SELECT note FROM day_notes WHERE date = ?1", [date], |r| {
                r.get::<_, String>(0)
            })
            .optional()?;
        Ok(note)
    }

    /// Toggles the star and returns the new state.
    pub fn toggle_star(&self, photo_id: i64) -> Result<bool> {
        self.conn.execute(
            "UPDATE photos SET starred = 1 - starred WHERE id = ?1",
            [photo_id],
        )?;
        let starred: i64 = self.conn.query_row(
            "SELECT starred FROM photos WHERE id = ?1",
            [photo_id],
            |r| r.get(0),
        )?;
        Ok(starred != 0)
    }

    pub fn set_caption(&self, photo_id: i64, caption: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE photos SET caption = ?2 WHERE id = ?1",
            params![photo_id, caption],
        )?;
        Ok(())
    }

    /// Returns photos on the given date ('YYYY-MM-DD'), ordered by taken_at ascending.
    pub fn photos_on_date(&self, date: &str) -> Result<Vec<PhotoRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, store_path, store_bytes, thumb_path, taken_at, lat, lng,
                    width, height, original_filename, original_hash, place, imported_at,
                    starred, caption
             FROM photos
             WHERE substr(taken_at, 1, 10) = ?1
             ORDER BY taken_at ASC",
        )?;
        let rows = stmt.query_map([date], Self::map_photo_row)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Returns dates ('YYYY-MM-DD') that have a photo or a note, descending.
    pub fn distinct_dates(&self) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT substr(taken_at, 1, 10) AS d FROM photos
             UNION
             SELECT date AS d FROM day_notes
             ORDER BY d DESC",
        )?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Library statistics.
    pub fn stats(&self) -> Result<Stats> {
        let (used_bytes, photo_count, starred_count): (i64, i64, i64) = self.conn.query_row(
            "SELECT
                COALESCE(SUM(store_bytes), 0),
                COUNT(*),
                COALESCE(SUM(starred), 0)
             FROM photos",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        let day_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM (
                SELECT substr(taken_at, 1, 10) AS d FROM photos
                UNION
                SELECT date AS d FROM day_notes
             )",
            [],
            |r| r.get(0),
        )?;
        Ok(Stats {
            used_bytes,
            photo_count,
            day_count,
            starred_count,
        })
    }

    /// Maps a `photos` row to a `PhotoRow`.
    pub(crate) fn map_photo_row(r: &Row<'_>) -> rusqlite::Result<PhotoRow> {
        Ok(PhotoRow {
            id: r.get("id")?,
            store_path: r.get("store_path")?,
            store_bytes: r.get("store_bytes")?,
            thumb_path: r.get("thumb_path")?,
            taken_at: r.get("taken_at")?,
            lat: r.get("lat")?,
            lng: r.get("lng")?,
            width: r.get::<_, i64>("width")? as u32,
            height: r.get::<_, i64>("height")? as u32,
            original_filename: r.get("original_filename")?,
            original_hash: r.get("original_hash")?,
            place: r.get("place")?,
            starred: r.get::<_, i64>("starred")? != 0,
            caption: r.get("caption")?,
            imported_at: r.get("imported_at")?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::NewPhoto;

    fn sample_photo(hash: &str, taken_at: &str) -> NewPhoto {
        NewPhoto {
            store_path: format!("store/{hash}.avif"),
            store_bytes: 1_000,
            thumb_path: Some(format!("thumb/{hash}.avif")),
            taken_at: taken_at.to_string(),
            lat: Some(35.0),
            lng: Some(139.0),
            width: 1920,
            height: 1080,
            original_filename: format!("{hash}.jpg"),
            original_hash: hash.to_string(),
            place: Some("Tokyo".to_string()),
            imported_at: "2026-01-01T00:00:00".to_string(),
        }
    }

    #[test]
    fn open_in_memory_is_migrated() {
        let db = Db::open_in_memory().unwrap();
        // If migrated, queries against every table succeed.
        assert_eq!(db.distinct_dates().unwrap(), Vec::<String>::new());
        let s = db.stats().unwrap();
        assert_eq!(s.photo_count, 0);
        assert_eq!(s.day_count, 0);
        assert_eq!(s.used_bytes, 0);
        assert_eq!(s.starred_count, 0);
    }

    #[test]
    fn upsert_folder_is_idempotent_by_path() {
        let db = Db::open_in_memory().unwrap();
        let id1 = db.upsert_folder("/photos/a").unwrap();
        let id2 = db.upsert_folder("/photos/a").unwrap();
        assert_eq!(id1, id2);
        let id3 = db.upsert_folder("/photos/b").unwrap();
        assert_ne!(id1, id3);
    }

    #[test]
    fn insert_and_query_photos_on_date() {
        let db = Db::open_in_memory().unwrap();
        assert!(!db.photo_exists("h1").unwrap());

        let id = db
            .insert_photo(&sample_photo("h1", "2026-07-04T16:42:00"))
            .unwrap();
        assert!(id > 0);
        assert!(db.photo_exists("h1").unwrap());

        let rows = db.photos_on_date("2026-07-04").unwrap();
        assert_eq!(rows.len(), 1);
        let row = &rows[0];
        assert_eq!(row.id, id);
        assert_eq!(row.original_hash, "h1");
        assert_eq!(row.width, 1920);
        assert_eq!(row.height, 1080);
        assert_eq!(row.lat, Some(35.0));
        assert!(!row.starred);
        assert_eq!(row.caption, None);

        // Does not appear on a different date.
        assert!(db.photos_on_date("2026-07-05").unwrap().is_empty());
    }

    #[test]
    fn photos_on_date_ordered_by_taken_at_asc() {
        let db = Db::open_in_memory().unwrap();
        db.insert_photo(&sample_photo("late", "2026-07-04T18:00:00"))
            .unwrap();
        db.insert_photo(&sample_photo("early", "2026-07-04T08:00:00"))
            .unwrap();
        let rows = db.photos_on_date("2026-07-04").unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].original_hash, "early");
        assert_eq!(rows[1].original_hash, "late");
    }

    #[test]
    fn toggle_star_flips_true_then_false() {
        let db = Db::open_in_memory().unwrap();
        let id = db
            .insert_photo(&sample_photo("h1", "2026-07-04T16:42:00"))
            .unwrap();
        assert!(db.toggle_star(id).unwrap());
        assert!(!db.toggle_star(id).unwrap());
    }

    #[test]
    fn set_caption_persists() {
        let db = Db::open_in_memory().unwrap();
        let id = db
            .insert_photo(&sample_photo("h1", "2026-07-04T16:42:00"))
            .unwrap();
        db.set_caption(id, "sunset").unwrap();
        let rows = db.photos_on_date("2026-07-04").unwrap();
        assert_eq!(rows[0].caption, Some("sunset".to_string()));
    }

    #[test]
    fn set_note_then_get_note() {
        let db = Db::open_in_memory().unwrap();
        assert_eq!(db.get_note("2026-07-04").unwrap(), None);
        db.set_note("2026-07-04", "good day").unwrap();
        assert_eq!(
            db.get_note("2026-07-04").unwrap(),
            Some("good day".to_string())
        );
        // upsert: overwrites.
        db.set_note("2026-07-04", "great day").unwrap();
        assert_eq!(
            db.get_note("2026-07-04").unwrap(),
            Some("great day".to_string())
        );
    }

    #[test]
    fn distinct_dates_includes_photo_and_note_days_desc() {
        let db = Db::open_in_memory().unwrap();
        db.insert_photo(&sample_photo("h1", "2026-07-04T16:42:00"))
            .unwrap();
        // A note-only day with no photos.
        db.set_note("2026-07-06", "note only").unwrap();
        // A duplicate day (photo day == note day) collapses to one via UNION.
        db.set_note("2026-07-04", "same day note").unwrap();

        let dates = db.distinct_dates().unwrap();
        assert_eq!(dates, vec!["2026-07-06", "2026-07-04"]);
    }

    #[test]
    fn stats_aggregates_correctly() {
        let db = Db::open_in_memory().unwrap();
        let mut p1 = sample_photo("h1", "2026-07-04T16:42:00");
        p1.store_bytes = 100;
        let mut p2 = sample_photo("h2", "2026-07-05T10:00:00");
        p2.store_bytes = 250;
        let id1 = db.insert_photo(&p1).unwrap();
        db.insert_photo(&p2).unwrap();
        db.toggle_star(id1).unwrap();
        // Add one note-only day with no photos.
        db.set_note("2026-07-10", "note").unwrap();

        let s = db.stats().unwrap();
        assert_eq!(s.used_bytes, 350);
        assert_eq!(s.photo_count, 2);
        assert_eq!(s.starred_count, 1);
        // 2 photo days + 1 note-only day = 3.
        assert_eq!(s.day_count, 3);
    }

    #[test]
    fn open_creates_file_and_migrates() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("photo-diary.db");
        {
            let db = Db::open(&path).unwrap();
            db.insert_photo(&sample_photo("h1", "2026-07-04T16:42:00"))
                .unwrap();
        }
        assert!(path.exists());
        // Reopening keeps the data (migration is idempotent).
        let db = Db::open(&path).unwrap();
        assert!(db.photo_exists("h1").unwrap());
        assert_eq!(db.photos_on_date("2026-07-04").unwrap().len(), 1);
    }
}
