use std::env;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions, TryLockError};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use sha2::{Digest, Sha256};

use crate::child;

const DEFAULT_MAX_CHILDREN: usize = 3;
const MAX_CHILDREN_VAR: &str = "ULTRAHAND_MAX_CHILDREN";
const POLL: Duration = Duration::from_millis(250);

/// A lock the kernel drops when this process ends, however it ends. The file stays behind
/// and means nothing, so a crash needs no cleanup and no stale-lock check.
pub struct Held {
    _file: File,
}

pub fn max_children() -> Result<usize, String> {
    parse_max_children(env::var_os(MAX_CHILDREN_VAR).as_deref())
}

fn parse_max_children(value: Option<&OsStr>) -> Result<usize, String> {
    let Some(value) = value.filter(|text| !text.is_empty()) else {
        return Ok(DEFAULT_MAX_CHILDREN);
    };
    let text = value.to_string_lossy();
    match text.parse() {
        Ok(cap) if cap > 0 => Ok(cap),
        _ => Err(format!(
            "{MAX_CHILDREN_VAR} is {text:?}; it has to be a whole number above 0"
        )),
    }
}

pub fn cache_dir() -> Result<PathBuf, String> {
    let home = env::var_os("HOME");
    let xdg = env::var_os("XDG_CACHE_HOME");
    cache_dir_from(home.as_deref(), xdg.as_deref(), cfg!(target_os = "macos"))
        .ok_or_else(|| "can't find the user cache folder; set HOME".to_owned())
}

fn cache_dir_from(home: Option<&OsStr>, xdg: Option<&OsStr>, macos: bool) -> Option<PathBuf> {
    let home = home.filter(|text| !text.is_empty()).map(Path::new);
    let xdg = xdg.map(Path::new).filter(|path| path.is_absolute());
    let base = if macos {
        home?.join("Library/Caches")
    } else {
        match xdg {
            Some(path) => path.to_path_buf(),
            None => home?.join(".cache"),
        }
    };
    Some(base.join("ultrahand"))
}

fn try_hold(path: &Path) -> Result<Option<Held>, String> {
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(path)
        .map_err(|e| format!("{}: {e}", path.display()))?;
    match file.try_lock() {
        Ok(()) => Ok(Some(Held { _file: file })),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(error)) => Err(format!("{}: {error}", path.display())),
    }
}

/// Waits for one of the machine's slots. Every run on the machine counts against the same
/// files, so several tasks share the cap. None means the run was interrupted while queued.
pub fn take_slot(folder: &Path, cap: usize) -> Result<Option<Held>, String> {
    while !child::interrupted() {
        for slot in 0..cap {
            if let Some(held) = try_hold(&folder.join(format!("slot-{slot}.lock")))? {
                return Ok(Some(held));
            }
        }
        thread::sleep(POLL);
    }
    Ok(None)
}

/// Two runs writing one folder would overwrite each other's units and merged file, so the
/// second is refused.
pub fn hold_out_folder(cache: &Path, out: &Path) -> Result<Held, String> {
    let runs = cache.join("runs");
    fs::create_dir_all(&runs).map_err(|e| format!("{}: {e}", runs.display()))?;
    let out_path = fs::canonicalize(out).map_err(|e| format!("{}: {e}", out.display()))?;
    let digest = Sha256::digest(out_path.as_os_str().as_encoded_bytes());
    let name: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    try_hold(&runs.join(format!("{name}.lock")))?
        .ok_or_else(|| format!("another run is writing to {}", out.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_cap_defaults_to_three_and_takes_a_positive_number() {
        assert_eq!(parse_max_children(None), Ok(3));
        assert_eq!(parse_max_children(Some("".as_ref())), Ok(3));
        assert_eq!(parse_max_children(Some("7".as_ref())), Ok(7));
        for bad in ["0", "-1", "two", "1.5"] {
            let error = parse_max_children(Some(bad.as_ref())).unwrap_err();
            assert!(error.contains(MAX_CHILDREN_VAR), "{error}");
        }
    }

    #[test]
    fn the_cache_folder_follows_the_platform() {
        let home = Some(OsStr::new("/h"));
        let xdg = Some(OsStr::new("/x"));
        let found = |home, xdg, macos| cache_dir_from(home, xdg, macos).unwrap();
        assert_eq!(
            found(home, xdg, true),
            Path::new("/h/Library/Caches/ultrahand")
        );
        assert_eq!(found(home, xdg, false), Path::new("/x/ultrahand"));
        assert_eq!(found(home, None, false), Path::new("/h/.cache/ultrahand"));
        assert_eq!(
            found(home, Some(OsStr::new("relative")), false),
            Path::new("/h/.cache/ultrahand")
        );
        assert_eq!(cache_dir_from(None, None, true), None);
    }

    #[test]
    fn a_held_slot_is_skipped_and_freed_on_drop() {
        let dir = tempfile::tempdir().unwrap();
        let first = take_slot(dir.path(), 2).unwrap().unwrap();
        let second = take_slot(dir.path(), 2).unwrap().unwrap();
        assert!(try_hold(&dir.path().join("slot-0.lock")).unwrap().is_none());
        assert!(try_hold(&dir.path().join("slot-1.lock")).unwrap().is_none());
        drop(first);
        drop(second);
        assert!(try_hold(&dir.path().join("slot-0.lock")).unwrap().is_some());
    }

    #[test]
    fn a_lock_file_nobody_holds_is_free() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("slot-0.lock"), "left by a crash").unwrap();
        assert!(take_slot(dir.path(), 1).unwrap().is_some());
    }

    #[test]
    fn one_out_folder_is_held_once() {
        let dir = tempfile::tempdir().unwrap();
        let out = dir.path().join("out");
        fs::create_dir(&out).unwrap();
        let held = hold_out_folder(dir.path(), &out).unwrap();
        assert!(hold_out_folder(dir.path(), &out).is_err());
        drop(held);
        assert!(hold_out_folder(dir.path(), &out).is_ok());
    }
}
