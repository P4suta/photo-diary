# photo-diary

Local photo diary for Windows with notes and a calendar.
Group photos by capture date, add notes, and browse days or the yearly heatmap.

Imports store full-resolution AVIF copies and SQLite metadata locally.
**Keep your original files and their backups.**
The AVIF copies omit EXIF and ICC metadata.
Capture time, GPS, and dimensions remain in the database.

## Run from source

Install [mise](https://mise.jdx.dev/) and the Windows build requirements in the [development guide](docs/DEVELOPMENT.md).
There is no published release yet.

```sh
git clone https://github.com/P4suta/photo-diary.git
cd photo-diary
mise install
mise x -- just setup
mise x -- just app-dev
```

See [development](docs/DEVELOPMENT.md), [architecture](docs/ARCHITECTURE.md), and [contributing](CONTRIBUTING.md) for details.

## License

Project code is [MIT](LICENSE-MIT) OR [Apache-2.0](LICENSE-APACHE).
Contributions use the same terms unless you explicitly state otherwise.

Windows binaries include `zenavif` under AGPL-3.0-only unless the distributor holds Imazen's commercial license.
Read the [third-party notices](THIRD_PARTY_NOTICES.md) before redistributing binaries.
