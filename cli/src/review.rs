use std::env;
use std::ffi::OsString;
use std::fs;
use std::io::{self, Write};
use std::net::TcpListener;
use std::path::{self, Path, PathBuf};
use std::time::{Duration, Instant};

use clap::Args;
use serde::Serialize;

use crate::child::{self, Ending, Finished, Launch, Stop};
use crate::launch::{self, Options};
use crate::prompt;
use crate::report::Report;
use crate::stream::{Summary, Tokens};

const STDERR_IN_ERROR: usize = 500;
const STOP_AT_COMPACTIONS: u64 = 2;
const DRIVE_CLOSE_LIMIT: Duration = Duration::from_secs(15);

#[derive(Args)]
pub struct ReviewArgs {
    /// The brief, sent to the reviewer as its message
    #[arg(long, value_name = "FILE")]
    brief: PathBuf,
    /// Writes <PATH>.md and <PATH>.json [default: the brief's path with "brief" swapped for "review"]
    #[arg(long, value_name = "PATH")]
    out: Option<PathBuf>,
    /// The reviewer's working folder [default: the brief's folder]
    #[arg(long, value_name = "DIR")]
    cwd: Option<PathBuf>,
    /// A folder the reviewer may read; repeat for more
    #[arg(long = "add-dir", value_name = "DIR")]
    add_dirs: Vec<PathBuf>,
    #[arg(long, default_value = "opus")]
    model: String,
    #[arg(long, default_value = "")]
    effort: String,
    /// Minutes before the reviewer and everything it started are stopped
    #[arg(long, value_name = "MINUTES", default_value = "20", value_parser = minutes)]
    timeout: f64,
    /// The ultrahand plugin folder [default: found from this binary's location]
    #[arg(long, value_name = "DIR")]
    plugin_root: Option<PathBuf>,
}

fn minutes(text: &str) -> Result<f64, String> {
    let value: f64 = text
        .parse()
        .map_err(|_| format!("{text} is not a number"))?;
    let seconds = Duration::try_from_secs_f64(value * 60.0).map_err(|e| e.to_string())?;
    if seconds.is_zero() {
        return Err("must be more than 0".into());
    }
    Ok(value)
}

struct Job {
    brief_path: PathBuf,
    message: Vec<u8>,
    out: PathBuf,
    cwd: PathBuf,
    add_dirs: Vec<PathBuf>,
    model: String,
    effort: String,
    timeout_minutes: f64,
    root: PathBuf,
    port: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TokenRecord {
    input: u64,
    output: u64,
    cache_write: u64,
    cache_read: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FirstTurnRecord {
    cache_write: u64,
    cache_read: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    brief: PathBuf,
    model: String,
    effort: Option<String>,
    ok: bool,
    error: Option<String>,
    turns: u64,
    seconds: u64,
    cost_usd: f64,
    tokens: TokenRecord,
    first_turn: Option<FirstTurnRecord>,
    system_prompt: String,
    compactions: u64,
    peak_context: u64,
    report: Option<Report>,
}

struct Done {
    record: Record,
    markdown: Option<String>,
    line: String,
}

impl From<&Tokens> for TokenRecord {
    fn from(tokens: &Tokens) -> Self {
        TokenRecord {
            input: tokens.input,
            output: tokens.output,
            cache_write: tokens.cache_write,
            cache_read: tokens.cache_read,
        }
    }
}

/// Ok(true) when the review finished, Ok(false) when a child ran and failed, Err for bad
/// usage, which is refused before anything starts.
pub fn run(args: ReviewArgs) -> Result<bool, String> {
    let job = prepare(args)?;
    let text = prompt::system_prompt(&job.root).map_err(|e| format!("plugin root: {e}"))?;
    let system = prompt::write_system_prompt(&text, &env::temp_dir())
        .map_err(|e| format!("system prompt: {e}"))?;
    let done = review(&job, &system);
    let (ok, line) = match write_outputs(&job, &done.record, done.markdown.as_deref()) {
        Ok(()) => (done.record.ok, done.line),
        Err(error) => (
            false,
            format!("review failed: can't write {}: {error}", job.out.display()),
        ),
    };
    let _ = writeln!(io::stdout(), "{line}");
    Ok(ok)
}

fn with_suffix(base: &Path, suffix: &str) -> PathBuf {
    let mut name = base.as_os_str().to_owned();
    name.push(suffix);
    PathBuf::from(name)
}

pub fn default_out(brief: &Path) -> PathBuf {
    let file = brief.file_name().unwrap_or_default().to_string_lossy();
    let name = file.strip_suffix(".md").unwrap_or(&file);
    let renamed = match name.strip_prefix("brief") {
        Some(rest) => format!("review{rest}"),
        None => format!("{name}.review"),
    };
    brief.with_file_name(renamed)
}

fn folder_of(path: &Path) -> &Path {
    match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent,
        _ => Path::new("."),
    }
}

fn absolute(path: &Path) -> Result<PathBuf, String> {
    path::absolute(path).map_err(|e| format!("{}: {e}", path.display()))
}

fn existing_folder(path: &Path) -> Result<PathBuf, String> {
    if path.is_dir() {
        absolute(path)
    } else {
        Err(format!("{} is not a folder", path.display()))
    }
}

fn plugin_root(given: Option<&Path>) -> Result<PathBuf, String> {
    let found = match given {
        Some(root) => Some(root.to_path_buf()),
        None => env::current_exe().ok().and_then(|exe| {
            let exe = fs::canonicalize(exe).ok()?;
            let manifest = Path::new(".claude-plugin/plugin.json");
            exe.ancestors()
                .find(|dir| dir.join(manifest).is_file())
                .map(Path::to_path_buf)
        }),
    };
    let root = found.ok_or("can't find the plugin root; pass --plugin-root")?;
    fs::canonicalize(&root).map_err(|e| format!("{}: {e}", root.display()))
}

fn free_port() -> Result<u16, String> {
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .map_err(|e| format!("no free port for the browser: {e}"))
}

/// The prefix has to match across children, so what differs per child goes in the message.
/// The shell lock only passes the literal form, and the plugin's own docs show others.
fn browser_note(root: &Path, port: u16) -> String {
    let drive = launch::drive_command(root);
    format!(
        "\n\nBrowser: this shell runs one command, written exactly like this, on its own, with \
         steps inline as JSON:\n\n{drive} <open|do> ... --port {port}\n\nAnything else is denied: \
         a relative path, a variable, an environment prefix, a pipe, a redirect, a heredoc, \
         a second command, or a --chrome flag. Always pass --port {port}. The browser is closed \
         for you when you finish.\n"
    )
}

fn prepare(args: ReviewArgs) -> Result<Job, String> {
    let brief = fs::read(&args.brief).map_err(|e| format!("{}: {e}", args.brief.display()))?;
    let out = args.out.clone().unwrap_or_else(|| default_out(&args.brief));
    let out = absolute(&out)?;
    let cwd = args.cwd.as_deref().unwrap_or(folder_of(&args.brief));
    let cwd = existing_folder(cwd)?;
    let add_dirs: Result<Vec<_>, _> = args.add_dirs.iter().map(|d| existing_folder(d)).collect();
    let root = plugin_root(args.plugin_root.as_deref())?;
    fs::create_dir_all(folder_of(&out)).map_err(|e| format!("{}: {e}", out.display()))?;
    let port = free_port()?;
    let mut message = brief;
    message.extend_from_slice(browser_note(&root, port).as_bytes());
    Ok(Job {
        brief_path: absolute(&args.brief)?,
        message,
        out,
        cwd,
        add_dirs: add_dirs?,
        model: args.model,
        effort: args.effort,
        timeout_minutes: args.timeout,
        root,
        port,
    })
}

fn claude_program() -> OsString {
    env::var_os("ULTRAHAND_CLAUDE")
        .filter(|name| !name.is_empty())
        .unwrap_or("claude".into())
}

fn review(job: &Job, system: &Path) -> Done {
    let program = claude_program();
    let args = launch::claude_args(&Options {
        system,
        model: &job.model,
        effort: &job.effort,
        add_dirs: &job.add_dirs,
        root: &job.root,
    });
    let child_env = launch::child_env(env::vars_os());
    let started = Instant::now();
    let mut summary = Summary::default();
    let finished = child::run(
        Launch {
            program: &program,
            args: &args,
            cwd: &job.cwd,
            env: &child_env,
            input: job.message.clone(),
            timeout: Duration::from_secs_f64(job.timeout_minutes * 60.0),
        },
        |line| {
            summary.feed(line);
            (summary.compactions >= STOP_AT_COMPACTIONS).then_some(Stop::CompactedTwice)
        },
    );
    if !matches!(finished.ending, Ending::NotStarted(_)) {
        close_browser(job, &child_env);
    }

    let seconds = if summary.seconds > 0 {
        summary.seconds
    } else {
        started.elapsed().as_secs()
    };
    let (report, error) = outcome(job, &program, &finished, &summary);
    let markdown = report.as_ref().map(Report::to_markdown).or_else(|| {
        let text = summary.report_text();
        (!text.is_empty()).then(|| text.to_owned())
    });
    let record = Record {
        brief: job.brief_path.clone(),
        model: job.model.clone(),
        effort: (!job.effort.is_empty()).then(|| job.effort.clone()),
        ok: error.is_none(),
        error,
        turns: summary.turns,
        seconds,
        cost_usd: summary.cost_usd,
        tokens: (&summary.tokens).into(),
        first_turn: summary.first_turn.as_ref().map(|first| FirstTurnRecord {
            cache_write: first.cache_write,
            cache_read: first.cache_read,
        }),
        system_prompt: system
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        compactions: summary.compactions,
        peak_context: summary.peak_context,
        report,
    };
    let line = summary_line(&job.out, &record);
    Done {
        record,
        markdown,
        line,
    }
}

/// A browser is its own process group by design and outlives both a group kill and a
/// normal exit, so it's closed here however the child ended.
fn close_browser(job: &Job, env: &[(OsString, OsString)]) {
    let script = job.root.join("shared/input/drive.mjs");
    let args = [
        script.into(),
        "close".into(),
        "--port".into(),
        job.port.to_string().into(),
    ];
    child::run_briefly("node".as_ref(), &args, &job.cwd, env, DRIVE_CLOSE_LIMIT);
}

fn outcome(
    job: &Job,
    program: &OsString,
    finished: &Finished,
    summary: &Summary,
) -> (Option<Report>, Option<String>) {
    match failure(job, program, finished, summary) {
        Some(error) => (None, Some(error)),
        None => match summary.structured.as_ref().map(Report::parse) {
            None => (
                None,
                Some("the result holds no structured findings".to_owned()),
            ),
            Some(Err(error)) => (None, Some(format!("invalid findings: {error}"))),
            Some(Ok(report)) => (Some(report), None),
        },
    }
}

fn failure(
    job: &Job,
    program: &OsString,
    finished: &Finished,
    summary: &Summary,
) -> Option<String> {
    let status = match &finished.ending {
        Ending::NotStarted(error) => {
            return Some(format!(
                "could not start {}: {error}",
                program.to_string_lossy()
            ));
        }
        Ending::Stopped(Stop::TimedOut) => {
            return Some(format!("timed out after {} min", job.timeout_minutes));
        }
        Ending::Stopped(Stop::CompactedTwice) => {
            return Some("stopped after a second compaction".to_owned());
        }
        Ending::Stopped(Stop::Interrupted) => return Some("interrupted".to_owned()),
        Ending::Exited(status) => status,
    };
    if summary.ok && status.success() {
        return None;
    }
    let exit = match status.code() {
        Some(code) => format!("claude exited {code}"),
        None => format!("claude was killed ({status})"),
    };
    if summary.ok {
        return Some(exit);
    }
    if let Some(error) = &summary.error {
        return Some(error.clone());
    }
    let stderr: String = finished
        .stderr
        .trim()
        .chars()
        .take(STDERR_IN_ERROR)
        .collect();
    if !stderr.is_empty() {
        return Some(stderr);
    }
    Some(if status.success() {
        format!("{exit} with no result event")
    } else {
        exit
    })
}

fn write_outputs(job: &Job, record: &Record, markdown: Option<&str>) -> io::Result<()> {
    let report_path = with_suffix(&job.out, ".md");
    match markdown {
        Some(text) => fs::write(&report_path, text.trim_end().to_owned() + "\n")?,
        None => remove_stale(&report_path)?,
    }
    let json = serde_json::to_string_pretty(record)?;
    fs::write(with_suffix(&job.out, ".json"), json + "\n")
}

fn remove_stale(path: &Path) -> io::Result<()> {
    match fs::remove_file(path) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

fn compaction_mark(compactions: u64) -> String {
    match compactions {
        0 => String::new(),
        1 => " · compacted once".to_owned(),
        count => format!(" · compacted {count} times"),
    }
}

fn summary_line(out: &Path, record: &Record) -> String {
    let compacted = compaction_mark(record.compactions);
    if let Some(error) = &record.error {
        let error = error.split_whitespace().collect::<Vec<_>>().join(" ");
        let json = with_suffix(out, ".json");
        return format!("review failed: {error} ({}){compacted}", json.display());
    }
    let first = record.first_turn.as_ref().map_or(String::new(), |first| {
        format!(
            ", first turn {} cached / {} written",
            first.cache_read, first.cache_write
        )
    });
    format!(
        "review: {} · {} · {} turns · {}s · ${:.2}{first} · peak {}{compacted}",
        with_suffix(out, ".md").display(),
        record.model,
        record.turns,
        record.seconds,
        record.cost_usd,
        record.peak_context,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_report_path_follows_the_brief() {
        assert_eq!(
            default_out(Path::new("r/2/brief-1.md")),
            Path::new("r/2/review-1")
        );
        assert_eq!(
            default_out(Path::new("r/2/notes.md")),
            Path::new("r/2/notes.review")
        );
        assert_eq!(default_out(Path::new("brief.md")), Path::new("review"));
    }

    #[test]
    fn an_out_path_with_a_dot_keeps_it() {
        assert_eq!(
            with_suffix(Path::new("r/review.v2"), ".md"),
            Path::new("r/review.v2.md")
        );
    }

    #[test]
    fn a_timeout_has_to_be_a_positive_number_of_minutes() {
        assert_eq!(minutes("0.5"), Ok(0.5));
        for bad in ["abc", "0", "-1", "inf", "NaN"] {
            assert!(minutes(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn the_browser_note_names_the_exact_command_and_port() {
        let note = browser_note(Path::new("/plugin"), 41234);
        assert!(note.contains("node /plugin/shared/input/drive.mjs <open|do> ... --port 41234"));
    }

    #[test]
    fn a_plugin_path_with_a_space_is_quoted_in_the_note() {
        let note = browser_note(Path::new("/my plugin"), 41234);
        assert!(note.contains("node \"/my plugin/shared/input/drive.mjs\" <open|do>"));
    }
}
