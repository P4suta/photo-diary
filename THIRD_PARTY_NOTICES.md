# Third-party notices

photo-diary is fully offline. Location names are resolved with the embedded GeoNames data shipped by [`reverse_geocoder` 4.1.1](https://crates.io/crates/reverse_geocoder); no coordinate or photo data is sent to a network service.

## GeoNames

The geographical database is provided by [GeoNames](https://www.geonames.org/) under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/).

Changes made by photo-diary: the nearest embedded record is checked with a haversine distance calculation and accepted only within 50 km; the displayed value is reduced to `city name, country code`.

## reverse_geocoder

`reverse_geocoder` is used under its MIT OR Apache-2.0 license. Its source and license information are available from the [crate documentation](https://docs.rs/reverse_geocoder/4.1.1/reverse_geocoder/).

## zenavif

[`zenavif` 0.1.6](https://docs.rs/zenavif/0.1.6/zenavif/) is used only to decode photo-diary's internal AVIF masters when rebuilding the WebP thumbnail cache. Its safe pure-Rust decoder is enabled without the optional assembly/C-FFI feature. AVIF files found in watched folders remain unsupported inputs and are reported as skipped.

`zenavif` is distributed under `AGPL-3.0-only OR LicenseRef-Imazen-Commercial`. This project uses the AGPL-3.0-only option unless the distributor has obtained Imazen's commercial license. Distributors of a photo-diary binary must comply with the AGPL-3.0-only terms for the combined distribution.
