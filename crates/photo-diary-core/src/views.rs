//! Read-query layer. DB -> DTO (raw data). Presentation is built on the frontend.

use crate::db::Db;
use crate::dto::{
    DayClusterDto, DayCountDto, DayPhotosPageDto, DaySummaryDto, MonthRecordDto, NoteDto, PhotoDto,
    PlaceFacetDto, TimelineDayDto, TimelineFilterDto,
};
use crate::model::FolderRow;
use crate::Result;
use rusqlite::params_from_iter;
use rusqlite::types::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

const PHOTO_COLS: &str = "id, store_path, store_bytes, thumb_path, taken_at, lat, lng, \
    width, height, original_filename, original_hash, place, imported_at, starred, caption";

impl Db {
    /// Bounded timeline read. Ordinary days return all of their (at most 30) matching
    /// photos; digest days return four representatives and never materialize the whole day.
    pub fn timeline_days(
        &self,
        filter: &TimelineFilterDto,
        data_dir: &Path,
    ) -> Result<Vec<TimelineDayDto>> {
        let (where_sql, args) = timeline_where(filter, "p");
        let sql = format!(
            "SELECT substr(p.taken_at,1,10) AS date,
                    COUNT(*) AS photo_count,
                    (SELECT p2.place FROM photos p2
                     WHERE substr(p2.taken_at,1,10)=substr(p.taken_at,1,10)
                       AND p2.place IS NOT NULL
                     GROUP BY p2.place ORDER BY COUNT(*) DESC, p2.place ASC LIMIT 1) AS place,
                    (SELECT note FROM day_notes n
                     WHERE n.date=substr(p.taken_at,1,10)) AS note
             FROM photos p
             WHERE {where_sql}
             GROUP BY date
             ORDER BY date DESC"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(args), |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, Option<String>>(3)?,
            ))
        })?;
        let mut summaries = Vec::new();
        for row in rows {
            summaries.push(row?);
        }

        let mut out = Vec::with_capacity(summaries.len());
        for (date, photo_count, place, note) in summaries {
            let photos = if photo_count <= 30 {
                self.day_photo_rows(&date, None, 31, false, filter)?
            } else {
                self.representative_photo_rows(&date, photo_count, filter)?
            }
            .into_iter()
            .map(|row| PhotoDto::from_row(row, data_dir))
            .collect();
            out.push(TimelineDayDto {
                date,
                place,
                photo_count,
                note,
                photos,
            });
        }

        // With no filter, note-only days are part of the diary. Search results deliberately
        // contain only days with a matching photo while still carrying that day's note.
        if filter.start_date.is_none() && filter.end_date.is_none() && filter.places.is_empty() {
            let existing: BTreeSet<String> = out.iter().map(|d| d.date.clone()).collect();
            for note in self.all_notes()? {
                if !existing.contains(&note.date) {
                    out.push(TimelineDayDto {
                        date: note.date,
                        place: None,
                        photo_count: 0,
                        note: Some(note.note),
                        photos: Vec::new(),
                    });
                }
            }
            out.sort_by(|a, b| b.date.cmp(&a.date));
        }
        Ok(out)
    }

    pub fn day_summary(&self, date: &str) -> Result<DaySummaryDto> {
        let (photo_count, starred_count, place): (i64, i64, Option<String>) = self.conn.query_row(
            "SELECT COUNT(*), COALESCE(SUM(starred),0),
                        (SELECT place FROM photos
                         WHERE substr(taken_at,1,10)=?1 AND place IS NOT NULL
                         GROUP BY place ORDER BY COUNT(*) DESC, place ASC LIMIT 1)
                 FROM photos WHERE substr(taken_at,1,10)=?1",
            [date],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        Ok(DaySummaryDto {
            date: date.to_string(),
            clusters: self.day_clusters(date, place.as_deref())?,
            place,
            photo_count,
            starred_count,
            note: self.get_note(date)?,
        })
    }

    /// Full-day chapter metadata without loading image DTOs. Only capture time and place are read,
    /// keeping day detail scalable while its 120-photo pages remain lazy.
    fn day_clusters(&self, date: &str, fallback_place: Option<&str>) -> Result<Vec<DayClusterDto>> {
        let mut stmt = self.conn.prepare(
            "SELECT taken_at, place FROM photos
             WHERE substr(taken_at,1,10)=?1
             ORDER BY taken_at ASC, id ASC",
        )?;
        let rows = stmt.query_map([date], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })?;

        struct ActiveCluster {
            time: String,
            label: String,
            count: i64,
        }

        let mut out = Vec::new();
        let mut active: Option<ActiveCluster> = None;
        let mut previous_seconds = None;
        let mut previous_place: Option<String> = None;
        for row in rows {
            let (taken_at, place) = row?;
            let seconds = seconds_of_day(&taken_at);
            let place_changed =
                previous_place.is_some() && place.is_some() && previous_place != place;
            let gap_reached = previous_seconds
                .zip(seconds)
                .is_some_and(|(previous, current)| current - previous >= 90 * 60);
            if active.is_none() || gap_reached || place_changed {
                if let Some(cluster) = active.take() {
                    out.push(DayClusterDto {
                        time: cluster.time,
                        label: cluster.label,
                        count: cluster.count,
                    });
                }
                active = Some(ActiveCluster {
                    time: taken_at.get(11..16).unwrap_or("").to_string(),
                    label: place
                        .as_deref()
                        .or(fallback_place)
                        .unwrap_or("")
                        .to_string(),
                    count: 1,
                });
            } else if let Some(cluster) = &mut active {
                cluster.count += 1;
            }
            previous_seconds = seconds;
            previous_place = place;
        }
        if let Some(cluster) = active {
            out.push(DayClusterDto {
                time: cluster.time,
                label: cluster.label,
                count: cluster.count,
            });
        }
        Ok(out)
    }

    /// Stable ascending cursor page ordered by `(taken_at, id)`. The cursor itself contains
    /// both values so photos with identical capture timestamps cannot be skipped or repeated.
    pub fn day_photos_page(
        &self,
        date: &str,
        cursor: Option<&str>,
        limit: usize,
        starred_only: bool,
        data_dir: &Path,
    ) -> Result<DayPhotosPageDto> {
        let limit = limit.clamp(1, 120);
        let rows = self.day_photo_rows(
            date,
            cursor,
            limit + 1,
            starred_only,
            &TimelineFilterDto::default(),
        )?;
        let has_more = rows.len() > limit;
        let page_rows: Vec<_> = rows.into_iter().take(limit).collect();
        let next_cursor = if has_more {
            page_rows.last().map(|p| format!("{}|{}", p.taken_at, p.id))
        } else {
            None
        };
        Ok(DayPhotosPageDto {
            photos: page_rows
                .into_iter()
                .map(|row| PhotoDto::from_row(row, data_dir))
                .collect(),
            next_cursor,
        })
    }

    fn day_photo_rows(
        &self,
        date: &str,
        cursor: Option<&str>,
        limit: usize,
        starred_only: bool,
        filter: &TimelineFilterDto,
    ) -> Result<Vec<crate::model::PhotoRow>> {
        let (filter_sql, mut args) = timeline_where(filter, "p");
        let mut sql = format!(
            "SELECT {PHOTO_COLS} FROM photos p
             WHERE substr(p.taken_at,1,10)=? AND {filter_sql}"
        );
        args.insert(0, Value::Text(date.to_string()));
        if starred_only {
            sql.push_str(" AND p.starred=1");
        }
        if let Some(raw) = cursor {
            let (taken_at, id) = parse_cursor(raw)?;
            sql.push_str(" AND (p.taken_at > ? OR (p.taken_at = ? AND p.id > ?))");
            args.push(Value::Text(taken_at.clone()));
            args.push(Value::Text(taken_at));
            args.push(Value::Integer(id));
        }
        sql.push_str(" ORDER BY p.taken_at ASC, p.id ASC LIMIT ?");
        args.push(Value::Integer(limit as i64));

        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(args), Self::map_photo_row)?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }

    /// Star-first cover selection, then evenly distributed capture-time samples.
    fn representative_photo_rows(
        &self,
        date: &str,
        count: i64,
        filter: &TimelineFilterDto,
    ) -> Result<Vec<crate::model::PhotoRow>> {
        let all = self.day_photo_rows(date, None, 31, true, filter)?;
        let mut out: Vec<_> = all.into_iter().take(4).collect();
        let wanted = 4usize.saturating_sub(out.len());
        let offsets: Vec<i64> = (1..=wanted)
            .map(|i| ((count - 1).max(0) * i as i64) / (wanted as i64 + 1))
            .collect();
        for offset in offsets {
            let (filter_sql, mut args) = timeline_where(filter, "p");
            let sql = format!(
                "SELECT {PHOTO_COLS} FROM photos p
                 WHERE substr(p.taken_at,1,10)=? AND {filter_sql}
                 ORDER BY p.taken_at ASC, p.id ASC LIMIT 1 OFFSET ?"
            );
            args.insert(0, Value::Text(date.to_string()));
            args.push(Value::Integer(offset));
            let row = self
                .conn
                .query_row(&sql, params_from_iter(args), Self::map_photo_row)?;
            if !out.iter().any(|p| p.id == row.id) {
                out.push(row);
            }
        }
        if out.len() < 4 {
            for row in self.day_photo_rows(date, None, 4, false, filter)? {
                if !out.iter().any(|p| p.id == row.id) {
                    out.push(row);
                }
                if out.len() == 4 {
                    break;
                }
            }
        }
        out.sort_by(|a, b| a.taken_at.cmp(&b.taken_at).then(a.id.cmp(&b.id)));
        Ok(out)
    }
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

    /// Place facets scoped by the current inclusive date range. Place selections themselves
    /// are intentionally ignored so users can add another OR-place without the facet vanishing.
    pub fn place_facets_filtered(&self, filter: &TimelineFilterDto) -> Result<Vec<PlaceFacetDto>> {
        let range_only = TimelineFilterDto {
            start_date: filter.start_date.clone(),
            end_date: filter.end_date.clone(),
            places: Vec::new(),
        };
        let (where_sql, args) = timeline_where(&range_only, "p");
        let sql = format!(
            "SELECT p.place, COUNT(*) AS c FROM photos p
             WHERE {where_sql}
             GROUP BY p.place ORDER BY c DESC, p.place ASC"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(args), |r| {
            Ok((r.get::<_, Option<String>>(0)?, r.get::<_, i64>(1)?))
        })?;
        let mut out = Vec::new();
        for row in rows {
            let (place, count) = row?;
            let selected = filter.places.iter().any(|p| p == &place);
            out.push(PlaceFacetDto {
                label: place.clone().unwrap_or_else(|| "No location".to_string()),
                count,
                selected,
                muted: place.is_none(),
            });
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

fn timeline_where(filter: &TimelineFilterDto, alias: &str) -> (String, Vec<Value>) {
    let mut clauses = vec!["1=1".to_string()];
    let mut args = Vec::new();
    if let Some(start) = &filter.start_date {
        clauses.push(format!("substr({alias}.taken_at,1,10) >= ?"));
        args.push(Value::Text(start.clone()));
    }
    if let Some(end) = &filter.end_date {
        clauses.push(format!("substr({alias}.taken_at,1,10) <= ?"));
        args.push(Value::Text(end.clone()));
    }
    if !filter.places.is_empty() {
        let mut places = Vec::new();
        for place in &filter.places {
            match place {
                Some(value) => {
                    places.push(format!("{alias}.place = ?"));
                    args.push(Value::Text(value.clone()));
                }
                None => places.push(format!("{alias}.place IS NULL")),
            }
        }
        clauses.push(format!("({})", places.join(" OR ")));
    }
    (clauses.join(" AND "), args)
}

fn parse_cursor(cursor: &str) -> Result<(String, i64)> {
    let (taken_at, id) = cursor
        .rsplit_once('|')
        .ok_or_else(|| crate::Error::Other("invalid day-photo cursor".to_string()))?;
    let id = id
        .parse::<i64>()
        .map_err(|_| crate::Error::Other("invalid day-photo cursor id".to_string()))?;
    Ok((taken_at.to_string(), id))
}

fn seconds_of_day(taken_at: &str) -> Option<i64> {
    let hour = taken_at.get(11..13)?.parse::<i64>().ok()?;
    let minute = taken_at.get(14..16)?.parse::<i64>().ok()?;
    let second = taken_at.get(17..19)?.parse::<i64>().ok()?;
    Some(hour * 3_600 + minute * 60 + second)
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

    #[test]
    fn timeline_filter_combines_inclusive_dates_with_or_places() {
        let db = Db::open_in_memory().unwrap();
        for (hash, date, place) in [
            ("tokyo", "2026-07-04T08:00:00", Some("Tokyo")),
            ("osaka", "2026-07-05T08:00:00", Some("Osaka")),
            ("none", "2026-07-05T09:00:00", None),
            ("outside", "2026-08-01T08:00:00", Some("Tokyo")),
        ] {
            let mut p = photo(hash, date);
            p.place = place.map(str::to_string);
            db.insert_photo(&p).unwrap();
        }

        let filter = TimelineFilterDto {
            start_date: Some("2026-07-05".into()),
            end_date: Some("2026-07-05".into()),
            places: vec![Some("Osaka".into()), None],
        };
        let days = db.timeline_days(&filter, data_dir()).unwrap();
        assert_eq!(days.len(), 1);
        assert_eq!(days[0].date, "2026-07-05");
        assert_eq!(days[0].photo_count, 2);
    }

    #[test]
    fn note_only_days_appear_only_without_a_photo_filter() {
        let db = Db::open_in_memory().unwrap();
        db.set_note("2026-07-10", "note without photos").unwrap();

        let diary = db
            .timeline_days(&TimelineFilterDto::default(), data_dir())
            .unwrap();
        assert_eq!(diary.len(), 1);
        assert_eq!(diary[0].date, "2026-07-10");
        assert_eq!(diary[0].photo_count, 0);
        assert_eq!(diary[0].note.as_deref(), Some("note without photos"));

        let filtered = db
            .timeline_days(
                &TimelineFilterDto {
                    start_date: Some("2026-07-01".to_string()),
                    end_date: None,
                    places: Vec::new(),
                },
                data_dir(),
            )
            .unwrap();
        assert!(
            filtered.is_empty(),
            "search results require a matching photo rather than adding note-only days"
        );
    }

    #[test]
    fn day_cursor_is_stable_when_capture_times_are_identical() {
        let db = Db::open_in_memory().unwrap();
        let first_id = db
            .insert_photo(&photo("first", "2026-07-04T08:00:00"))
            .unwrap();
        let second_id = db
            .insert_photo(&photo("second", "2026-07-04T08:00:00"))
            .unwrap();

        let first = db
            .day_photos_page("2026-07-04", None, 1, false, data_dir())
            .unwrap();
        assert_eq!(first.photos[0].id, first_id.to_string());
        let second = db
            .day_photos_page(
                "2026-07-04",
                first.next_cursor.as_deref(),
                1,
                false,
                data_dir(),
            )
            .unwrap();
        assert_eq!(second.photos[0].id, second_id.to_string());
        assert_ne!(first.photos[0].id, second.photos[0].id);
        assert_eq!(second.next_cursor, None, "the final page has no cursor");
    }

    #[test]
    fn seconds_of_day_keeps_hour_minute_and_second_coefficients_distinct() {
        assert_eq!(seconds_of_day("2026-07-04T01:02:03"), Some(3_723));
        assert_eq!(seconds_of_day("2026-07-04T00:00:00"), Some(0));
        assert_eq!(seconds_of_day("invalid"), None);
    }

    #[test]
    fn digest_representatives_are_bounded_and_star_first() {
        let db = Db::open_in_memory().unwrap();
        let mut starred_id = 0;
        for minute in 0..31 {
            let id = db
                .insert_photo(&photo(
                    &format!("p{minute:02}"),
                    &format!("2026-07-04T08:{minute:02}:00"),
                ))
                .unwrap();
            if minute == 30 {
                starred_id = id;
                db.toggle_star(id).unwrap();
            }
        }
        let day = db
            .timeline_days(&TimelineFilterDto::default(), data_dir())
            .unwrap()
            .remove(0);
        assert_eq!(day.photo_count, 31);
        assert!(day.photos.len() <= 4);
        assert!(day
            .photos
            .iter()
            .any(|photo| photo.id == starred_id.to_string()));
    }

    #[test]
    fn digest_samples_are_evenly_distributed_by_capture_order() {
        let db = Db::open_in_memory().unwrap();
        for minute in 0..32 {
            db.insert_photo(&photo(
                &format!("p{minute:02}"),
                &format!("2026-07-04T08:{minute:02}:00"),
            ))
            .unwrap();
        }

        let names: Vec<String> = db
            .timeline_days(&TimelineFilterDto::default(), data_dir())
            .unwrap()
            .remove(0)
            .photos
            .into_iter()
            .map(|photo| photo.original_filename)
            .collect();
        assert_eq!(names, vec!["p06.jpg", "p12.jpg", "p18.jpg", "p24.jpg"]);
    }

    #[test]
    fn digest_fills_a_duplicate_time_sample_without_repeating_a_star() {
        let mut db = Db::open_in_memory().unwrap();
        for minute in 0..31 {
            let id = db
                .insert_photo(&photo(
                    &format!("p{minute:02}"),
                    &format!("2026-07-04T08:{minute:02}:00"),
                ))
                .unwrap();
            if [0, 1, 15].contains(&minute) {
                db.set_starred(&[id], true).unwrap();
            }
        }

        let names: Vec<String> = db
            .timeline_days(&TimelineFilterDto::default(), data_dir())
            .unwrap()
            .remove(0)
            .photos
            .into_iter()
            .map(|photo| photo.original_filename)
            .collect();
        assert_eq!(names, vec!["p00.jpg", "p01.jpg", "p02.jpg", "p15.jpg"]);
    }

    #[test]
    fn filtered_facets_keep_range_counts_and_mark_only_exact_selections() {
        let db = Db::open_in_memory().unwrap();
        for (hash, place) in [
            ("tokyo-a", Some("Tokyo")),
            ("tokyo-b", Some("Tokyo")),
            ("osaka", Some("Osaka")),
            ("none", None),
        ] {
            let mut p = photo(hash, "2026-07-04T08:00:00");
            p.place = place.map(str::to_string);
            db.insert_photo(&p).unwrap();
        }
        let mut outside = photo("outside", "2026-08-01T08:00:00");
        outside.place = Some("Kyoto".to_string());
        db.insert_photo(&outside).unwrap();

        let facets = db
            .place_facets_filtered(&TimelineFilterDto {
                start_date: Some("2026-07-01".to_string()),
                end_date: Some("2026-07-31".to_string()),
                places: vec![Some("Tokyo".to_string())],
            })
            .unwrap();
        assert_eq!(facets.len(), 3);

        let tokyo = facets.iter().find(|facet| facet.label == "Tokyo").unwrap();
        assert_eq!(tokyo.count, 2);
        assert!(tokyo.selected);
        assert!(!tokyo.muted);

        let osaka = facets.iter().find(|facet| facet.label == "Osaka").unwrap();
        assert_eq!(osaka.count, 1);
        assert!(!osaka.selected);
        assert!(!osaka.muted);

        let none = facets
            .iter()
            .find(|facet| facet.label == "No location")
            .unwrap();
        assert_eq!(none.count, 1);
        assert!(!none.selected);
        assert!(none.muted);
        assert!(facets.iter().all(|facet| facet.label != "Kyoto"));
    }

    #[test]
    fn day_summary_clusters_the_entire_day_at_ninety_minutes_or_a_place_change() {
        let db = Db::open_in_memory().unwrap();
        for (hash, taken_at, place) in [
            ("a", "2026-07-04T09:00:00", Some("Tokyo")),
            ("b", "2026-07-04T09:30:00", Some("Tokyo")),
            ("c", "2026-07-04T11:00:00", Some("Tokyo")),
            ("d", "2026-07-04T11:10:00", Some("Osaka")),
            ("e", "2026-07-04T11:20:00", None),
        ] {
            let mut p = photo(hash, taken_at);
            p.place = place.map(str::to_string);
            db.insert_photo(&p).unwrap();
        }

        let summary = db.day_summary("2026-07-04").unwrap();
        assert_eq!(summary.photo_count, 5);
        assert_eq!(
            summary.clusters,
            vec![
                DayClusterDto {
                    time: "09:00".to_string(),
                    label: "Tokyo".to_string(),
                    count: 2,
                },
                DayClusterDto {
                    time: "11:00".to_string(),
                    label: "Tokyo".to_string(),
                    count: 1,
                },
                DayClusterDto {
                    time: "11:10".to_string(),
                    label: "Osaka".to_string(),
                    count: 2,
                },
            ]
        );
    }
}
