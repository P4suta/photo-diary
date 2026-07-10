// Don't show a console window in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    photo_diary_lib::run();
}
