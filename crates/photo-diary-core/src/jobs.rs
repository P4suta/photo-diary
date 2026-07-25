//! Single-flight coordination for every storage-mutating library job.

use crate::{Error, Result};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobState {
    pub running: bool,
    pub paused: bool,
}

pub struct JobManager {
    running: AtomicBool,
    paused: Mutex<bool>,
    resumed: Condvar,
}

impl JobManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            running: AtomicBool::new(false),
            paused: Mutex::new(false),
            resumed: Condvar::new(),
        })
    }

    pub fn try_start(self: &Arc<Self>) -> Result<JobGuard> {
        self.running
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| Error::Other("another library job is already running".to_string()))?;
        Ok(JobGuard {
            manager: Arc::clone(self),
        })
    }

    pub fn set_paused(&self, paused: bool) {
        *self.paused.lock().unwrap_or_else(|e| e.into_inner()) = paused;
        if !paused {
            self.resumed.notify_all();
        }
    }

    /// Cooperative pause point. Call between files, never while a DB or filesystem handle is held.
    pub fn wait_if_paused(&self) {
        let mut paused = self.paused.lock().unwrap_or_else(|e| e.into_inner());
        while *paused {
            paused = self
                .resumed
                .wait(paused)
                .unwrap_or_else(|error| error.into_inner());
        }
    }

    pub fn state(&self) -> JobState {
        JobState {
            running: self.running.load(Ordering::Acquire),
            paused: *self.paused.lock().unwrap_or_else(|e| e.into_inner()),
        }
    }
}

pub struct JobGuard {
    manager: Arc<JobManager>,
}

impl Drop for JobGuard {
    fn drop(&mut self) {
        self.manager.running.store(false, Ordering::Release);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn only_one_job_can_run() {
        let manager = JobManager::new();
        let first = manager.try_start().unwrap();
        assert!(manager.try_start().is_err());
        drop(first);
        assert!(manager.try_start().is_ok());
    }

    #[test]
    fn pause_blocks_only_at_cooperative_boundary_then_resumes() {
        let manager = JobManager::new();
        manager.set_paused(true);
        let worker = Arc::clone(&manager);
        let (tx, rx) = mpsc::channel();
        let handle = thread::spawn(move || {
            worker.wait_if_paused();
            tx.send(()).unwrap();
        });
        assert!(rx.recv_timeout(Duration::from_millis(30)).is_err());
        manager.set_paused(false);
        rx.recv_timeout(Duration::from_secs(1)).unwrap();
        handle.join().unwrap();
    }
}
