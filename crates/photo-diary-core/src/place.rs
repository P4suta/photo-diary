//! Offline reverse-geocoding boundary. v0.1 deliberately has no network provider.

use reverse_geocoder::ReverseGeocoder;

pub const PLACE_RESOLVER_VERSION: i64 = 1;
pub const MAX_PLACE_DISTANCE_KM: f64 = 50.0;

pub trait PlaceResolver: Send + Sync {
    fn resolve(&self, lat: f64, lng: f64) -> Option<String>;
    fn version(&self) -> i64;
}

/// Embedded GeoNames-backed resolver supplied by `reverse_geocoder`.
pub struct OfflinePlaceResolver {
    geocoder: ReverseGeocoder,
}

impl OfflinePlaceResolver {
    pub fn new() -> Self {
        Self {
            geocoder: ReverseGeocoder::new(),
        }
    }
}

impl Default for OfflinePlaceResolver {
    fn default() -> Self {
        Self::new()
    }
}

impl PlaceResolver for OfflinePlaceResolver {
    fn resolve(&self, lat: f64, lng: f64) -> Option<String> {
        // Inclusive floating-point ranges reject NaN and infinities as well as out-of-bounds
        // coordinates, so separate finiteness checks would only duplicate these two predicates.
        if !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lng) {
            return None;
        }
        let nearest = self.geocoder.search((lat, lng));
        place_within_limit(
            lat,
            lng,
            nearest.record.lat,
            nearest.record.lon,
            &nearest.record.name,
            &nearest.record.cc,
        )
    }

    fn version(&self) -> i64 {
        PLACE_RESOLVER_VERSION
    }
}

fn place_within_limit(
    lat: f64,
    lng: f64,
    city_lat: f64,
    city_lng: f64,
    city: &str,
    country_code: &str,
) -> Option<String> {
    (haversine_km(lat, lng, city_lat, city_lng) <= MAX_PLACE_DISTANCE_KM)
        .then(|| format!("{city}, {country_code}"))
}

/// Great-circle distance. The geocoder's tree distance is not a surface distance, so the
/// product rule is enforced against this value.
pub fn haversine_km(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let to_rad = std::f64::consts::PI / 180.0;
    let d_lat = (lat2 - lat1) * to_rad;
    let d_lng = (lng2 - lng1) * to_rad;
    let lat1 = lat1 * to_rad;
    let lat2 = lat2 * to_rad;
    let a = (d_lat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (d_lng / 2.0).sin().powi(2);
    2.0 * 6_371.008_8 * a.sqrt().asin()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn haversine_is_zero_for_same_point() {
        assert_eq!(haversine_km(35.0, 139.0, 35.0, 139.0), 0.0);
    }

    #[test]
    fn haversine_matches_one_equatorial_degree() {
        let distance = haversine_km(0.0, 0.0, 0.0, 1.0);
        assert!((distance - 111.195_080_233_532_9).abs() < 1e-9);
    }

    #[test]
    fn haversine_is_symmetric_away_from_the_equator() {
        let forward = haversine_km(35.6812, 139.7671, 34.6937, 135.5023);
        let reverse = haversine_km(34.6937, 135.5023, 35.6812, 139.7671);
        assert!((forward - reverse).abs() < 1e-9);
        assert!((390.0..410.0).contains(&forward));
    }

    #[test]
    fn fifty_km_boundary_is_inclusive() {
        // One latitude degree is approximately 111.195 km at the equator.
        let exactly = 50.0 / 111.195_080_233_532_9;
        assert!(place_within_limit(0.0, 0.0, exactly, 0.0, "Near", "ZZ").is_some());
        assert!(place_within_limit(0.0, 0.0, exactly + 0.001, 0.0, "Far", "ZZ").is_none());
    }

    #[test]
    fn embedded_resolver_finds_central_tokyo_offline() {
        let resolver = OfflinePlaceResolver::new();
        let place = resolver.resolve(35.6812, 139.7671).expect("Tokyo city");
        assert!(place.ends_with(", JP"));
        assert_eq!(resolver.version(), PLACE_RESOLVER_VERSION);
    }

    #[test]
    fn invalid_coordinates_do_not_resolve() {
        let resolver = OfflinePlaceResolver::new();
        assert_eq!(resolver.resolve(91.0, 0.0), None);
        assert_eq!(resolver.resolve(-91.0, 0.0), None);
        assert_eq!(resolver.resolve(0.0, 181.0), None);
        assert_eq!(resolver.resolve(0.0, -181.0), None);
        // Just across +180°, the embedded data has a city within 50 km. This proves the
        // longitude guard itself rejects the coordinate rather than relying on distance later.
        assert_eq!(resolver.resolve(63.0, 180.000_001), None);
        assert_eq!(resolver.resolve(f64::NAN, 0.0), None);
        assert_eq!(resolver.resolve(0.0, f64::NAN), None);
    }
}
