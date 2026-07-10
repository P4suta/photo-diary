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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::NewPhoto;
    use std::collections::BTreeMap;

    /// A read-only `data_dir`; the read layer only string-joins it (no fs access).
    fn data_dir() -> &'static Path {
        Path::new("/data")
    }

    /// A minimal photo keyed by `hash`, captured at `taken_at`.
    fn photo(hash: &str, taken_at: &str) -> NewPhoto {
        NewPhoto {
            store_path: format!("library/{hash}.avif"),
            store_bytes: 100,
            thumb_path: Some(format!("thumbnails/{hash}.webp")),
            taken_at: taken_at.to_string(),
            lat: None,
            lng: None,
            width: 1920,
            height: 1080,
            original_filename: format!("{hash}.jpg"),
            original_hash: hash.to_string(),
            place: None,
            imported_at: "2026-01-01T00:00:00".to_string(),
            folder_id: None,
        }
    }

    #[test]
    fn all_photos_ordered_by_taken_at_desc() {
        let db = Db::open_in_memory().unwrap();
        // Insert out of order; the query must return newest-first.
        db.insert_photo(&photo("a", "2026-07-04T08:00:00")).unwrap();
        db.insert_photo(&photo("c", "2026-07-06T08:00:00")).unwrap();
        db.insert_photo(&photo("b", "2026-07-05T08:00:00")).unwrap();

        let taken: Vec<String> = db
            .all_photos(data_dir())
            .unwrap()
            .into_iter()
            .map(|p| p.taken_at)
            .collect();
        assert_eq!(
            taken,
            vec![
                "2026-07-06T08:00:00",
                "2026-07-05T08:00:00",
                "2026-07-04T08:00:00",
            ]
        );
    }

    #[test]
    fn starred_photos_filters_and_orders_desc() {
        let db = Db::open_in_memory().unwrap();
        let a = db.insert_photo(&photo("a", "2026-07-04T08:00:00")).unwrap();
        db.insert_photo(&photo("b", "2026-07-05T08:00:00")).unwrap();
        let c = db.insert_photo(&photo("c", "2026-07-06T08:00:00")).unwrap();
        db.toggle_star(a).unwrap();
        db.toggle_star(c).unwrap();

        let starred = db.starred_photos(data_dir()).unwrap();
        assert_eq!(starred.len(), 2, "only the two starred photos are returned");
        assert!(starred.iter().all(|p| p.starred), "every result is starred");
        let taken: Vec<String> = starred.into_iter().map(|p| p.taken_at).collect();
        assert_eq!(
            taken,
            vec!["2026-07-06T08:00:00", "2026-07-04T08:00:00"],
            "starred results are newest-first"
        );
    }

    #[test]
    fn all_notes_ordered_by_date_desc() {
        let db = Db::open_in_memory().unwrap();
        db.set_note("2026-07-04", "first").unwrap();
        db.set_note("2026-07-06", "third").unwrap();
        db.set_note("2026-07-05", "second").unwrap();

        let notes = db.all_notes().unwrap();
        let dates: Vec<String> = notes.iter().map(|n| n.date.clone()).collect();
        assert_eq!(dates, vec!["2026-07-06", "2026-07-05", "2026-07-04"]);
        assert_eq!(notes[0].note, "third", "note text is carried through");
    }

    #[test]
    fn year_counts_groups_by_day_and_excludes_other_years() {
        let db = Db::open_in_memory().unwrap();
        // Two photos on the same day collapse to one grouped count of 2.
        db.insert_photo(&photo("j1", "2026-01-01T09:00:00"))
            .unwrap();
        db.insert_photo(&photo("j2", "2026-01-01T21:00:00"))
            .unwrap();
        db.insert_photo(&photo("m", "2026-06-15T12:00:00")).unwrap();
        // Boundary neighbours in adjacent years must not leak in.
        db.insert_photo(&photo("prev", "2025-12-31T23:00:00"))
            .unwrap();
        db.insert_photo(&photo("next", "2027-01-01T00:00:00"))
            .unwrap();

        let counts: BTreeMap<String, i64> = db
            .year_counts(2026)
            .unwrap()
            .into_iter()
            .map(|c| (c.date, c.count))
            .collect();
        assert_eq!(counts.len(), 2, "only the two 2026 days");
        assert_eq!(
            counts.get("2026-01-01"),
            Some(&2),
            "same-day photos grouped"
        );
        assert_eq!(counts.get("2026-06-15"), Some(&1));
        assert!(!counts.contains_key("2025-12-31"));
        assert!(!counts.contains_key("2027-01-01"));
    }

    #[test]
    fn year_counts_isolates_dec31_and_jan1_at_the_year_boundary() {
        let db = Db::open_in_memory().unwrap();
        db.insert_photo(&photo("dec", "2025-12-31T23:59:00"))
            .unwrap();
        db.insert_photo(&photo("jan", "2026-01-01T00:01:00"))
            .unwrap();

        let y2025 = db.year_counts(2025).unwrap();
        assert_eq!(y2025.len(), 1);
        assert_eq!(y2025[0].date, "2025-12-31");
        let y2026 = db.year_counts(2026).unwrap();
        assert_eq!(y2026.len(), 1);
        assert_eq!(y2026[0].date, "2026-01-01");
    }

    #[test]
    fn month_records_counts_note_only_days_and_respects_month_boundary() {
        let db = Db::open_in_memory().unwrap();
        // July photos: day 4 (x2), day 6 (x1).
        db.insert_photo(&photo("p1", "2026-07-04T08:00:00"))
            .unwrap();
        db.insert_photo(&photo("p2", "2026-07-04T20:00:00"))
            .unwrap();
        db.insert_photo(&photo("p3", "2026-07-06T10:00:00"))
            .unwrap();
        // A note on a photo day (4) and a note-only day (10, no photos).
        db.set_note("2026-07-04", "with photos").unwrap();
        db.set_note("2026-07-10", "note only").unwrap();
        // Neighbouring months (incl. their notes) must not leak into July.
        db.insert_photo(&photo("jun", "2026-06-30T23:00:00"))
            .unwrap();
        db.insert_photo(&photo("aug", "2026-08-01T00:00:00"))
            .unwrap();
        db.set_note("2026-08-05", "next month note").unwrap();

        let recs = db.month_records(2026, 7).unwrap();
        let by_day: BTreeMap<i64, &MonthRecordDto> = recs.iter().map(|r| (r.day, r)).collect();

        assert_eq!(by_day[&4].count, 2, "two photos on day 4");
        assert!(by_day[&4].has_note, "day 4 has a note");
        assert_eq!(by_day[&6].count, 1);
        assert!(!by_day[&6].has_note, "day 6 has photos but no note");
        assert_eq!(by_day[&10].count, 0, "note-only day has no photos");
        assert!(by_day[&10].has_note, "note-only day is flagged has_note");
        assert_eq!(
            by_day.keys().copied().collect::<Vec<_>>(),
            vec![4, 6, 10],
            "only July days appear, sorted; June/August excluded"
        );
    }

    #[test]
    fn place_facets_group_by_place_and_bucket_null_as_no_location() {
        let db = Db::open_in_memory().unwrap();
        // Tokyo x3, Osaka x2 (distinct counts so the DESC order is deterministic).
        for (i, place) in ["Tokyo", "Tokyo", "Tokyo", "Osaka", "Osaka"]
            .iter()
            .enumerate()
        {
            let mut p = photo(&format!("t{i}"), "2026-07-04T08:00:00");
            p.place = Some((*place).to_string());
            db.insert_photo(&p).unwrap();
        }
        // One photo with no place -> aggregated into the muted "No location" facet.
        db.insert_photo(&photo("nowhere", "2026-07-05T08:00:00"))
            .unwrap();

        let facets = db.place_facets().unwrap();
        // Ordered by count DESC: Tokyo(3), Osaka(2), then the null bucket(1).
        assert_eq!(facets[0].label, "Tokyo");
        assert_eq!(facets[0].count, 3);
        assert!(!facets[0].muted);
        assert!(!facets[0].selected);
        assert_eq!(facets[1].label, "Osaka");
        assert_eq!(facets[1].count, 2);

        let none = facets
            .iter()
            .find(|f| f.muted)
            .expect("a null-place bucket");
        assert_eq!(none.label, "No location");
        assert_eq!(none.count, 1);
    }

    #[test]
    fn last_import_returns_max_imported_at() {
        let db = Db::open_in_memory().unwrap();
        assert_eq!(
            db.last_import().unwrap(),
            None,
            "no photos -> no last import"
        );

        let mut a = photo("a", "2026-07-04T08:00:00");
        a.imported_at = "2026-07-04T10:00:00".into();
        let mut b = photo("b", "2026-07-05T08:00:00");
        b.imported_at = "2026-07-09T18:00:00".into();
        db.insert_photo(&a).unwrap();
        db.insert_photo(&b).unwrap();

        assert_eq!(
            db.last_import().unwrap(),
            Some("2026-07-09T18:00:00".to_string())
        );
    }
}
