// This entry is selected only by `vite build --mode native-e2e`. Keeping the
// WDIO bridge out of the normal entry prevents it from entering dev dependency
// optimization or production bundles.
import '@wdio/tauri-plugin'
import './main'
