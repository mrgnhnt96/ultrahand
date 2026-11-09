//! No handler can catch SIGKILL, and a child in its own process group never hears about
//! it, so a SIGKILL to this command used to leave every reviewer and its browser running.
//! A watchdog process holds the read end of a pipe from this one. Each reviewer group and
//! browser port is written to it while it runs and struck off once it's stopped. When the
//! pipe ends with anything still listed, this command died without stopping it, so the
//! watchdog does.

use std::collections::BTreeSet;
use std::env;
use std::ffi::OsStr;
use std::io::{self, BufRead, Write};
use std::os::unix::ffi::OsStrExt;
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{ChildStdin, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use crate::child;
use crate::launch;
use crate::review;

pub const SUBCOMMAND: &str = "watchdog";

static PIPE: OnceLock<Option<Mutex<ChildStdin>>> = OnceLock::new();

/// Started on first use. Without one the run still works; only a SIGKILL leaves things behind.
fn pipe() -> Option<&'static Mutex<ChildStdin>> {
    PIPE.get_or_init(|| match start() {
        Ok(stdin) => Some(Mutex::new(stdin)),
        Err(error) => {
            eprintln!("ultrahand: no watchdog ({error}); a SIGKILL would leave reviewers running");
            None
        }
    })
    .as_ref()
}

/// Its own process group, so a signal to this command's group leaves it to see the pipe end.
fn start() -> io::Result<ChildStdin> {
    let mut watchdog = Command::new(env::current_exe()?)
        .arg(SUBCOMMAND)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .process_group(0)
        .spawn()?;
    watchdog
        .stdin
        .take()
        .ok_or_else(|| io::Error::other("no pipe to the watchdog"))
}

fn send(line: &[u8]) {
    let Some(pipe) = pipe() else { return };
    if let Ok(mut stdin) = pipe.lock() {
        let _ = stdin.write_all(line);
    }
}

fn message(kind: &str, id: impl ToString, rest: Option<&Path>) -> Vec<u8> {
    let mut line = format!("{kind} {}", id.to_string()).into_bytes();
    if let Some(path) = rest {
        line.push(b' ');
        line.extend_from_slice(path.as_os_str().as_bytes());
    }
    line.push(b'\n');
    line
}

pub fn watch_group(group: libc::pid_t) {
    send(&message("group", group, None));
}

pub fn forget_group(group: libc::pid_t) {
    send(&message("done", group, None));
}

/// A plugin root with a line break in it can't be sent, so that browser goes unwatched.
pub fn watch_browser(port: u16, root: &Path) {
    if !root.as_os_str().as_bytes().contains(&b'\n') {
        send(&message("browser", port, Some(root)));
    }
}

pub fn forget_browser(port: u16) {
    send(&message("closed", port, None));
}

#[derive(Default, Debug, PartialEq)]
pub struct Left {
    pub groups: BTreeSet<libc::pid_t>,
    pub browsers: Vec<(u16, PathBuf)>,
}

impl Left {
    fn apply(&mut self, line: &[u8]) {
        let mut parts = line.splitn(3, |byte| *byte == b' ');
        let kind = parts.next().unwrap_or_default();
        let id = parts.next().and_then(|id| std::str::from_utf8(id).ok());
        let rest = parts.next();
        match (kind, id) {
            (b"group", Some(id)) => {
                if let Ok(group) = id.parse() {
                    self.groups.insert(group);
                }
            }
            (b"done", Some(id)) => {
                if let Ok(group) = id.parse() {
                    self.groups.remove(&group);
                }
            }
            (b"browser", Some(id)) => {
                if let (Ok(port), Some(root)) = (id.parse(), rest) {
                    self.browsers.retain(|(known, _)| *known != port);
                    self.browsers.push((port, OsStr::from_bytes(root).into()));
                }
            }
            (b"closed", Some(id)) => {
                if let Ok(port) = id.parse::<u16>() {
                    self.browsers.retain(|(known, _)| *known != port);
                }
            }
            _ => {}
        }
    }

    /// Everything still listed when the input ends.
    pub fn read(input: impl BufRead) -> Left {
        let mut left = Left::default();
        for line in input.split(b'\n') {
            match line {
                Ok(line) => left.apply(&line),
                Err(_) => break,
            }
        }
        left
    }
}

/// Runs until this command's end of the pipe closes, then stops what it left running:
/// reviewers first, so none opens another browser, then their browsers.
pub fn run() {
    for signal in [libc::SIGINT, libc::SIGTERM, libc::SIGHUP] {
        // SAFETY: setting a signal to be ignored touches no memory.
        unsafe { libc::signal(signal, libc::SIG_IGN) };
    }
    let left = Left::read(io::stdin().lock());
    for group in &left.groups {
        child::stop_orphaned_group(*group);
    }
    let env = launch::child_env(env::vars_os());
    for (port, root) in &left.browsers {
        review::close_browser(root, *port, root, &env);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn left(lines: &[&[u8]]) -> Left {
        let input: Vec<u8> = lines.iter().flat_map(|line| line.iter().copied()).collect();
        Left::read(input.as_slice())
    }

    #[test]
    fn what_was_struck_off_is_not_left() {
        let root = Path::new("/plugin root/with spaces");
        let left = left(&[
            &message("group", 41, None),
            &message("group", 42, None),
            &message("browser", 9333, Some(root)),
            &message("browser", 9334, Some(root)),
            &message("done", 41, None),
            &message("closed", 9334, None),
        ]);
        assert_eq!(left.groups, BTreeSet::from([42]));
        assert_eq!(left.browsers, vec![(9333, root.to_path_buf())]);
    }

    #[test]
    fn a_clean_run_leaves_nothing() {
        let root = Path::new("/plugin");
        let left = left(&[
            &message("group", 7, None),
            &message("browser", 9333, Some(root)),
            &message("done", 7, None),
            &message("closed", 9333, None),
        ]);
        assert_eq!(left, Left::default());
    }

    #[test]
    fn a_garbled_line_is_skipped() {
        let left = left(&[b"group x\n", b"browser 9333\n", b"what 1\n", b"group 5\n"]);
        assert_eq!(left.groups, BTreeSet::from([5]));
        assert!(left.browsers.is_empty());
    }
}
