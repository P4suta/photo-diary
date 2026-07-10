//! Read-query layer. DB -> DTO (raw data). Presentation is built on the frontend.

use crate::db::Db;
use crate::dto::{DayCountDto, MonthRecordDto, NoteDto, PhotoDto, PlaceFacetDto};
use crate::model::FolderRow;
use crate::Result;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

const PHOTO_COLS: &str = "id, store_path, store_bytes, thumb_path, taken_at, lat, lng, \
    width, height, original_filename, original_hash, place, imported_at, starred, caption";

impl Db {
    /// All photos, taken_at descending. `data_dir` resolves DB-relative thumb paths to absolute.
    pub fn all_photos(&self, data_dir: &Path) -> Result<Vec<PhotoDto>> {
        let sql = format!("SELECT {PHOTO_COLS} FROM photos ORDER BY taken_at DESC");
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map([], Self::map_photo_row)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(PhotoDto::from_row(r?, data_dir));
        }
        Ok(out)
    }

    /// Starred photos, taken_at descending. `data_dir` resolves DB-relative thumb paths.
    pub fn starred_photos(&self, data_dir: &Path) -> Result<Vec<PhotoDto>> {
        let sql =
            format!("SELECT {PHOTO_COLS} FROM photos WHERE starred = 1 ORDER BY taken_at DESC");
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map([], Self::map_photo_row)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(PhotoDto::from_row(r?, data_dir));
        }
        Ok(out)
    }

    /// All day notes.
    pub fn all_notes(&self) -> Result<Vec<NoteDto>> {
        let mut stmt = self
            .conn
            .prepare("SELECT date, note FROM day_notes ORDER BY date DESC")?;
        let rows = stmt.query_map([], |r| {
            Ok(NoteDto {
                date: r.get(0)?,
                note: r.get(1)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Per-date photo counts for a year (for the heatmap).
    pub fn year_counts(&self, year: i32) -> Result<Vec<DayCountDto>> {
        let y = format!("{year:04}");
        let mut stmt = self.conn.prepare(
            "SELECT substr(taken_at,1,10) AS d, COUNT(*) AS c FROM photos \
             WHERE substr(taken_at,1,4)=?1 GROUP BY d",
        )?;
        let rows = stmt.query_map([y.as_str()], |r| {
            Ok(DayCountDto {
                date: r.get(0)?,
                count: r.get(1)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Per-day records for a year-month (for the calendar). Only days with photos or a note.
    pub fn month_records(&self, year: i32, month: u32) -> Result<Vec<MonthRecordDto>> {
        let ym = format!("{year:04}-{month:02}");

        let mut counts: BTreeMap<i64, i64> = BTreeMap::new();
        {
            let mut stmt = self.conn.prepare(
                "SELECT CAST(substr(taken_at,9,2) AS INTEGER) AS day, COUNT(*) AS c \
                 FROM photos WHERE substr(taken_at,1,7)=?1 GROUP BY day",
            )?;
            let rows = stmt.query_map([ym.as_str()], |r| {
                Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?))
            })?;
            for r in rows {
                let (day, c) = r?;
                counts.insert(day, c);
            }
        }

        let mut note_days: BTreeSet<i64> = BTreeSet::new();
        {
            let mut stmt = self.conn.prepare(
                "SELECT CAST(substr(date,9,2) AS INTEGER) FROM day_notes WHERE substr(date,1,7)=?1",
            )?;
            let rows = stmt.query_map([ym.as_str()], |r| r.get::<_, i64>(0))?;
            for r in rows {
                note_days.insert(r?);
            }
        }

        let mut days: BTreeSet<i64> = counts.keys().copied().collect();
        days.extend(note_days.iter().copied());
        let out = days
            .into_iter()
            .map(|day| MonthRecordDto {
                day,
                count: counts.get(&day).copied().unwrap_or(0),
                has_note: note_days.contains(&day),
            })
            .collect();
        Ok(out)
    }

    /// Watched folders with a real photo count (LEFT JOIN on `photos.folder_id`, so folders
    /// with zero photos still appear with count 0) and the recorded `last_scan`. The fs-derived
    /// status is added by the Library layer; the Db stays fs-free.
    pub fn list_folders(&self) -> Result<Vec<FolderRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.id, f.path, f.last_scan, COUNT(p.id) AS photo_count
             FROM folders f
             LEFT JOIN photos p ON p.folder_id = f.id
             GROUP BY f.id, f.path, f.last_scan
             ORDER BY f.id",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(FolderRow {
                id: r.get(0)?,
                path: r.get(1)?,
                last_scan: r.get(2)?,
                photo_count: r.get(3)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    /// Place facets (for search). NULL place is aggregated as "no location info".
    pub fn place_facets(&self) -> Result<Vec<PlaceFacetDto>> {
        let mut stmt = self
            .conn
            .prepare("SELECT place, COUNT(*) AS c FROM photos GROUP BY place ORDER BY c DESC")?;
        let rows = stmt.query_map([], |r| {
            Ok((r.get::<_, Option<String>>(0)?, r.get::<_, i64>(1)?))
        })?;
        let mut out = Vec::new();
        for r in rows {
            let (place, count) = r?;
            match place {
                Some(label) => out.push(PlaceFacetDto {
                    label,
                    count,
                    selected: false,
                    muted: false,
                }),
                None => out.push(PlaceFacetDto {
                    label: "No location".to_string(),
                    count,
                    selected: false,
                    muted: true,
                }),
            }
        }
        Ok(out)
    }

    /// Last import time (max imported_at).
    pub fn last_import(&self) -> Result<Option<String>> {
        let v: Option<String> = self.conn.query_row(
            "SELECT MAX(imported_at) FROM photos WHERE imported_at <> ''",
            [],
            |r| r.get(0),
        )?;
        Ok(v)
    }
}
