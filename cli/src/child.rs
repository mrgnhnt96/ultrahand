use std::ffi::{OsStr, OsString};
use std::io::{self, BufRead, BufReader, Read, Write};
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

const TICK: Duration = Duration::from_millis(50);
const TERM_GRACE: Duration = Duration::from_secs(5);
const DRAIN_LIMIT: Duration = Duration::from_secs(2);
const STDERR_LIMIT: usize = 64 * 1024;

static INTERRUPTED: AtomicBool = AtomicBool::new(false);

extern "C" fn note_interrupt(_signal: libc::c_int) {
    INTERRUPTED.store(true, Ordering::SeqCst);
}

/// A child runs in its own process group, so a signal aimed at this command never reaches
/// it. Noting the signal lets the run stop the group instead of leaving it running.
pub fn watch_signals() {
    let handler = note_interrupt as extern "C" fn(libc::c_int) as libc::sighandler_t;
    for signal in [libc::SIGINT, libc::SIGTERM, libc::SIGHUP] {
        // SAFETY: the handler only stores to an atomic, which is async-signal-safe.
        unsafe { libc::signal(signal, handler) };
    }
}

pub fn interrupted() -> bool {
    INTERRUPTED.load(Ordering::SeqCst)
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Stop {
    TimedOut,
    CompactedTwice,
    Interrupted,
}

pub enum Ending {
    NotStarted(io::Error),
    Exited(ExitStatus),
    Stopped(Stop),
}

pub struct Launch<'a> {
    pub program: &'a OsStr,
    pub args: &'a [OsString],
    pub cwd: &'a Path,
    pub env: &'a [(OsString, OsString)],
    pub input: Vec<u8>,
    pub timeout: Duration,
}

pub struct Finished {
    pub ending: Ending,
    pub stderr: String,
}

fn command(program: &OsStr, cwd: &Path, env: &[(OsString, OsString)]) -> Command {
    let mut command = Command::new(program);
    command
        .current_dir(cwd)
        .env_clear()
        .envs(env.iter().map(|(k, v)| (k, v)))
        .process_group(0);
    command
}

/// Runs a child in its own process group, handing each stdout line to `on_line`, which can
/// ask for the run to stop. Whatever the ending, nothing in the group is left running.
pub fn run(launch: Launch, mut on_line: impl FnMut(&[u8]) -> Option<Stop>) -> Finished {
    let started = command(launch.program, launch.cwd, launch.env)
        .args(launch.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();
    let mut child = match started {
        Ok(child) => child,
        Err(error) => {
            return Finished {
                ending: Ending::NotStarted(error),
                stderr: String::new(),
            };
        }
    };
    let group = child.id() as libc::pid_t;
    feed_stdin(&mut child, launch.input);
    let lines = read_lines(child.stdout.take());
    let stderr = read_stderr(child.stderr.take());

    let deadline = Instant::now() + launch.timeout;
    let ending = watch(&mut child, &lines, deadline, &mut on_line);
    let status = stop_group(group, &mut child);
    drain(&lines, &mut on_line);

    let ending = match ending {
        Watched::Stopped(stop) => Ending::Stopped(stop),
        Watched::Exited(status) => Ending::Exited(status),
        Watched::WaitFailed(error) => status.map_or(Ending::NotStarted(error), Ending::Exited),
    };
    let stderr = stderr
        .lock()
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned());
    Finished {
        ending,
        stderr: stderr.unwrap_or_default(),
    }
}

enum Watched {
    Exited(ExitStatus),
    Stopped(Stop),
    WaitFailed(io::Error),
}

fn watch(
    child: &mut Child,
    lines: &Receiver<Vec<u8>>,
    deadline: Instant,
    on_line: &mut impl FnMut(&[u8]) -> Option<Stop>,
) -> Watched {
    let mut stream_open = true;
    loop {
        if stream_open {
            match lines.recv_timeout(TICK) {
                Ok(line) => {
                    if let Some(stop) = on_line(&line) {
                        return Watched::Stopped(stop);
                    }
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => stream_open = false,
            }
        } else {
            thread::sleep(TICK);
        }
        if interrupted() {
            return Watched::Stopped(Stop::Interrupted);
        }
        if Instant::now() >= deadline {
            return Watched::Stopped(Stop::TimedOut);
        }
        match child.try_wait() {
            Ok(Some(status)) => return Watched::Exited(status),
            Ok(None) => {}
            Err(error) => return Watched::WaitFailed(error),
        }
    }
}

fn feed_stdin(child: &mut Child, input: Vec<u8>) {
    if let Some(mut stdin) = child.stdin.take() {
        thread::spawn(move || {
            let _ = stdin.write_all(&input);
        });
    }
}

fn read_lines(stdout: Option<impl Read + Send + 'static>) -> Receiver<Vec<u8>> {
    let (sender, receiver) = mpsc::channel();
    if let Some(stdout) = stdout {
        thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let mut line = Vec::new();
                match reader.read_until(b'\n', &mut line) {
                    Ok(0) | Err(_) => break,
                    Ok(_) if sender.send(line).is_err() => break,
                    Ok(_) => {}
                }
            }
        });
    }
    receiver
}

fn read_stderr(stderr: Option<impl Read + Send + 'static>) -> Arc<Mutex<Vec<u8>>> {
    let kept = Arc::new(Mutex::new(Vec::new()));
    if let Some(mut stderr) = stderr {
        let sink = Arc::clone(&kept);
        thread::spawn(move || {
            let mut chunk = [0; 8192];
            while let Ok(read) = stderr.read(&mut chunk) {
                if read == 0 {
                    break;
                }
                if let Ok(mut bytes) = sink.lock() {
                    let room = STDERR_LIMIT.saturating_sub(bytes.len());
                    bytes.extend_from_slice(&chunk[..read.min(room)]);
                }
            }
        });
    }
    kept
}

/// A process that outlives the child can hold the pipe open, so this stops at a time limit
/// rather than waiting for the stream to end.
fn drain(lines: &Receiver<Vec<u8>>, on_line: &mut impl FnMut(&[u8]) -> Option<Stop>) {
    let deadline = Instant::now() + DRAIN_LIMIT;
    while let Ok(line) = lines.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
        on_line(&line);
    }
}

fn signal_group(group: libc::pid_t, signal: libc::c_int) {
    // SAFETY: killpg takes plain integers and touches no memory.
    unsafe { libc::killpg(group, signal) };
}

fn group_alive(group: libc::pid_t) -> bool {
    // SAFETY: as above; signal 0 only checks that the group exists.
    let result = unsafe { libc::killpg(group, 0) };
    result == 0 || io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

/// TERM, then KILL for whatever hasn't gone when the grace ends. Polling also reaps the
/// child, because a zombie leader keeps its group looking alive.
fn stop_group(group: libc::pid_t, child: &mut Child) -> Option<ExitStatus> {
    signal_group(group, libc::SIGTERM);
    let deadline = Instant::now() + TERM_GRACE;
    let mut status = None;
    while Instant::now() < deadline {
        status = status.or(child.try_wait().ok().flatten());
        if status.is_some() && !group_alive(group) {
            return status;
        }
        thread::sleep(TICK);
    }
    signal_group(group, libc::SIGKILL);
    let _ = child.kill();
    status.or(child.wait().ok())
}

/// A short helper command: no input, no output, and it can't outlast `limit`. It ignores
/// signals noted for the run, because it may be the cleanup after one.
pub fn run_briefly(
    program: &OsStr,
    args: &[OsString],
    cwd: &Path,
    env: &[(OsString, OsString)],
    limit: Duration,
) {
    let spawned = command(program, cwd, env)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    let Ok(mut child) = spawned else { return };
    let deadline = Instant::now() + limit;
    while Instant::now() < deadline {
        if !matches!(child.try_wait(), Ok(None)) {
            return;
        }
        thread::sleep(TICK);
    }
    stop_group(child.id() as libc::pid_t, &mut child);
}
