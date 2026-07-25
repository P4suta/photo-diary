//! Deterministic watched-folder scheduling.
//!
//! Filesystem observation stays in the Tauri shell, while this state machine owns the product
//! rules: a fingerprint must remain stable for two seconds before import, a busy job must not
//! acknowledge the change, and a disconnected folder is probed only once per minute.

use std::collections::{HashMap, HashSet};
use std::time::Duration;

pub const WATCH_DEBOUNCE: Duration = Duration::from_secs(2);
pub const DISCONNECTED_RETRY: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FolderFingerprint {
    pub signature: u64,
    pub file_count: usize,
}

#[derive(Debug, Clone, Copy)]
struct FolderWatchState {
    imported: Option<FolderFingerprint>,
    pending: Option<(FolderFingerprint, Duration)>,
    next_probe: Duration,
}

impl Default for FolderWatchState {
    fn default() -> Self {
        Self {
            imported: None,
            pending: None,
            next_probe: Duration::ZERO,
        }
    }
}

#[derive(Debug, Default)]
pub struct FolderMonitor {
    folders: HashMap<String, FolderWatchState>,
}

impl FolderMonitor {
    /// Whether the shell should touch the filesystem for this folder at `now`.
    pub fn should_probe(&self, path: &str, now: Duration) -> bool {
        self.folders
            .get(path)
            .is_none_or(|state| now >= state.next_probe)
    }

    /// Records a disconnected probe and suppresses further filesystem checks for 60 seconds.
    pub fn observe_disconnected(&mut self, path: &str, now: Duration) {
        let state = self.folders.entry(path.to_string()).or_default();
        state.pending = None;
        state.next_probe = now.saturating_add(DISCONNECTED_RETRY);
    }

    /// Returns true only when a new fingerprint has remained unchanged for the full debounce.
    ///
    /// A true result is deliberately not acknowledged. The caller must invoke
    /// [`mark_imported`](Self::mark_imported) only after the library job succeeds, so a busy or
    /// failed job is retried on the next poll.
    pub fn observe_connected(
        &mut self,
        path: &str,
        fingerprint: FolderFingerprint,
        now: Duration,
    ) -> bool {
        let state = self.folders.entry(path.to_string()).or_default();
        state.next_probe = now;
        if state.imported == Some(fingerprint) {
            state.pending = None;
            return false;
        }
        match state.pending {
            Some((pending, since)) if pending == fingerprint => {
                now.saturating_sub(since) >= WATCH_DEBOUNCE
            }
            _ => {
                state.pending = Some((fingerprint, now));
                false
            }
        }
    }

    pub fn mark_imported(&mut self, path: &str, fingerprint: FolderFingerprint) {
        let state = self.folders.entry(path.to_string()).or_default();
        state.imported = Some(fingerprint);
        state.pending = None;
    }

    /// Forget registrations removed from SQLite rather than retaining stale monitor state.
    pub fn retain_registered<'a>(&mut self, paths: impl IntoIterator<Item = &'a str>) {
        let registered: HashSet<&str> = paths.into_iter().collect();
        self.folders
            .retain(|path, _| registered.contains(path.as_str()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIRST: FolderFingerprint = FolderFingerprint {
        signature: 10,
        file_count: 1,
    };
    const SECOND: FolderFingerprint = FolderFingerprint {
        signature: 20,
        file_count: 2,
    };

    #[test]
    fn imports_only_after_a_fingerprint_is_stable_for_two_seconds() {
        let mut monitor = FolderMonitor::default();
        assert!(!monitor.observe_connected("A", FIRST, Duration::ZERO));
        assert!(!monitor.observe_connected("A", SECOND, Duration::from_secs(1)));
        assert!(!monitor.observe_connected("A", SECOND, Duration::from_millis(2_999)));
        assert!(monitor.observe_connected("A", SECOND, Duration::from_secs(3)));
        monitor.mark_imported("A", SECOND);
        assert!(!monitor.observe_connected("A", SECOND, Duration::from_secs(5)));
    }

    #[test]
    fn a_busy_job_does_not_acknowledge_the_pending_change() {
        let mut monitor = FolderMonitor::default();
        assert!(!monitor.observe_connected("A", FIRST, Duration::ZERO));
        assert!(monitor.observe_connected("A", FIRST, Duration::from_secs(2)));
        // No mark_imported: the caller could not acquire the single-flight job.
        assert!(monitor.observe_connected("A", FIRST, Duration::from_secs(4)));
        monitor.mark_imported("A", FIRST);
        assert!(!monitor.observe_connected("A", FIRST, Duration::from_secs(6)));
    }

    #[test]
    fn disconnected_folders_are_not_probed_again_until_sixty_seconds() {
        let mut monitor = FolderMonitor::default();
        monitor.observe_disconnected("A", Duration::from_secs(5));
        assert!(!monitor.should_probe("A", Duration::from_secs(64)));
        assert!(monitor.should_probe("A", Duration::from_secs(65)));

        // Reconnection also uses the normal two-second stable debounce.
        assert!(!monitor.observe_connected("A", FIRST, Duration::from_secs(65)));
        assert!(!monitor.observe_connected("A", FIRST, Duration::from_secs(66)));
        assert!(monitor.observe_connected("A", FIRST, Duration::from_secs(67)));
    }

    #[test]
    fn removed_registrations_drop_their_scheduling_state() {
        let mut monitor = FolderMonitor::default();
        monitor.observe_disconnected("A", Duration::ZERO);
        monitor.observe_disconnected("B", Duration::ZERO);
        monitor.retain_registered(["B"]);
        assert!(monitor.should_probe("A", Duration::ZERO));
        assert!(!monitor.should_probe("B", Duration::ZERO));
    }
}
