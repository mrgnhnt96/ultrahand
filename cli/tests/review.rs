use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde_json::{Value, json};
use tempfile::TempDir;

/// A script written a moment ago can take seconds to start on macOS when many start at once,
/// so every limit here leaves room for that.
const FAST_TIMEOUT: &str = "0.2";
const SLOW_START: Duration = Duration::from_secs(30);

/// Records what it was given next to itself, so a test can read it back.
const CAPTURE: &str = r#"
me="$0"
printf '%s\n' "$@" > "$me.args"
env > "$me.env"
pwd > "$me.cwd"
echo "$$" > "$me.pid"
"#;

const READ_STDIN: &str = r#"cat > "$me.stdin""#;

/// Writes the arguments it was run with, one line per call.
const FAKE_DRIVE: &str = r#"
import { appendFileSync } from 'node:fs';
appendFileSync(new URL('./calls', import.meta.url), process.argv.slice(2).join(' ') + '\n');
"#;

fn findings() -> Value {
    json!({
        "verdict": "Ship after R1.",
        "findings": [{
            "id": "R1", "severity": 3, "title": "Low contrast", "element": "Search › hint",
            "evidence": "Confirmed", "problem": "Hard to read", "principle": "WCAG 1.4.3",
            "fix": "Raise to #595959",
        }],
        "what_works": ["Clear focus"],
        "not_checked": ["Dark mode"],
    })
}

fn result_event(structured: Value) -> Value {
    json!({
        "type": "result", "subtype": "success", "is_error": false,
        "result": structured.to_string(), "structured_output": structured,
        "num_turns": 2, "duration_ms": 3000, "total_cost_usd": 0.12,
        "usage": {
            "input_tokens": 9, "output_tokens": 2870,
            "cache_creation_input_tokens": 100, "cache_read_input_tokens": 20,
        },
    })
}

fn assistant_event() -> Value {
    json!({
        "type": "assistant",
        "message": {
            "id": "m1", "content": [],
            "usage": {
                "input_tokens": 5, "output_tokens": 7,
                "cache_creation_input_tokens": 100, "cache_read_input_tokens": 0,
            },
        },
    })
}

fn compaction_event() -> Value {
    json!({
        "type": "system", "subtype": "compact_boundary",
        "compact_metadata": { "pre_tokens": 151_000, "post_tokens": 17_000, "duration_ms": 900 },
    })
}

/// A shell line that prints one event, with the quoting done here.
fn emit(event: &Value) -> String {
    format!(
        "printf '%s\\n' '{}'",
        event.to_string().replace('\'', "'\\''")
    )
}

struct Fixture {
    _dir: TempDir,
    base: PathBuf,
    root: PathBuf,
    claude: PathBuf,
    brief: PathBuf,
    out: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        Self::in_folder("work")
    }

    fn in_folder(name: &str) -> Self {
        let dir = TempDir::new().unwrap();
        let base = fs::canonicalize(dir.path()).unwrap().join(name);
        let root = base.join("plugin");
        for (file, text) in [
            ("skills/review/references/method.md", "method"),
            ("skills/review/references/checklist.md", "checklist"),
            ("shared/input/README.md", "input"),
            ("shared/input/drive.mjs", FAKE_DRIVE),
        ] {
            let path = root.join(file);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, text).unwrap();
        }
        let brief = base.join("round/brief-1.md");
        fs::create_dir_all(brief.parent().unwrap()).unwrap();
        fs::write(&brief, "Review the search screen.\n").unwrap();
        let out = base.join("round/review-1");
        let claude = base.join("fake claude");
        Fixture {
            _dir: dir,
            base,
            root,
            claude,
            brief,
            out,
        }
    }

    fn fake_claude(&self, body: &str) {
        fs::write(&self.claude, format!("#!/bin/sh\n{CAPTURE}\n{body}\n")).unwrap();
        fs::set_permissions(&self.claude, fs::Permissions::from_mode(0o755)).unwrap();
    }

    /// A fake that reads its input and prints these events, then exits 0.
    fn fake_stream(&self, events: &[Value]) {
        let lines: Vec<String> = events.iter().map(emit).collect();
        self.fake_claude(&format!("{READ_STDIN}\n{}", lines.join("\n")));
    }

    fn command(&self) -> Command {
        let mut command = Command::new(env!("CARGO_BIN_EXE_ultrahand"));
        command
            .arg("review")
            .arg("--brief")
            .arg(&self.brief)
            .arg("--plugin-root")
            .arg(&self.root)
            .env("ULTRAHAND_CLAUDE", &self.claude);
        command
    }

    fn run(&self, extra: &[&str]) -> Output {
        self.command().args(extra).output().unwrap()
    }

    fn captured_path(&self, kind: &str) -> PathBuf {
        PathBuf::from(format!("{}.{kind}", self.claude.display()))
    }

    fn captured(&self, kind: &str) -> String {
        fs::read_to_string(self.captured_path(kind)).unwrap()
    }

    fn record(&self) -> Value {
        let text = fs::read_to_string(self.out.with_extension("json")).unwrap();
        serde_json::from_str(&text).unwrap()
    }

    fn error(&self) -> String {
        self.record()["error"].as_str().unwrap().to_owned()
    }

    fn report(&self) -> String {
        fs::read_to_string(self.report_path()).unwrap()
    }

    fn report_path(&self) -> PathBuf {
        self.out.with_extension("md")
    }

    fn drive_calls(&self) -> String {
        fs::read_to_string(self.root.join("shared/input/calls")).unwrap_or_default()
    }
}

fn stdout(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

fn gone(pid: i32) -> bool {
    // SAFETY: signal 0 only asks whether the process exists.
    unsafe { libc::kill(pid, 0) != 0 }
}

fn wait_until(limit: Duration, done: impl Fn() -> bool) -> bool {
    let deadline = Instant::now() + limit;
    while Instant::now() < deadline {
        if done() {
            return true;
        }
        thread::sleep(Duration::from_millis(50));
    }
    done()
}

fn pid_in(path: &Path) -> i32 {
    fs::read_to_string(path).unwrap().trim().parse().unwrap()
}

#[test]
fn a_run_writes_the_report_and_a_record_with_tokens_and_cost() {
    let f = Fixture::new();
    f.fake_stream(&[assistant_event(), result_event(findings())]);
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stdout(&output));

    assert!(f.report().contains("### R1 · 3 Major · Low contrast"));
    let record = f.record();
    assert_eq!(record["ok"], true);
    assert_eq!(record["error"], Value::Null);
    assert_eq!(record["model"], "opus");
    assert_eq!(record["turns"], 2);
    assert_eq!(record["costUsd"], 0.12);
    assert_eq!(record["tokens"]["output"], 2870);
    assert_eq!(record["firstTurn"]["cacheWrite"], 100);
    assert_eq!(record["report"]["findings"][0]["id"], "R1");
    let prompt = record["systemPrompt"].as_str().unwrap();
    assert!(
        prompt.starts_with("ultrahand-review-") && prompt.ends_with(".md"),
        "{prompt}"
    );
}

#[test]
fn the_child_gets_the_brief_on_stdin_and_runs_in_the_briefs_folder() {
    let f = Fixture::new();
    f.fake_stream(&[result_event(findings())]);
    f.run(&[]);
    assert!(
        f.captured("stdin")
            .starts_with("Review the search screen.\n")
    );
    assert_eq!(
        f.captured("cwd").trim(),
        f.brief.parent().unwrap().to_str().unwrap()
    );
}

#[test]
fn the_message_tells_the_child_the_exact_browser_command_and_port() {
    let f = Fixture::new();
    f.fake_stream(&[result_event(findings())]);
    f.run(&[]);
    let stdin = f.captured("stdin");
    let drive = f.root.join("shared/input/drive.mjs");
    assert!(
        stdin.contains(&format!("node {}", drive.display())),
        "{stdin}"
    );
    assert!(stdin.contains("--port "), "{stdin}");
}

#[test]
fn the_launch_flags_keep_the_child_locked_down() {
    let f = Fixture::new();
    f.fake_stream(&[result_event(findings())]);
    let extra = f.base.join("extra");
    fs::create_dir_all(&extra).unwrap();
    f.run(&[
        "--add-dir",
        extra.to_str().unwrap(),
        "--model",
        "sonnet",
        "--effort",
        "medium",
    ]);
    let args = f.captured("args");
    let lines: Vec<&str> = args.lines().collect();
    let after = |flag: &str| lines[lines.iter().position(|line| *line == flag).unwrap() + 1];
    assert_eq!(after("--model"), "sonnet");
    assert_eq!(after("--effort"), "medium");
    assert_eq!(after("--tools"), "Read,Glob,Grep,Bash");
    assert_eq!(after("--permission-mode"), "dontAsk");
    assert!(after("--allowedTools").contains("drive.mjs:*)"));
    assert!(
        !after("--allowedTools")
            .split(',')
            .any(|tool| tool == "Bash")
    );
    assert!(lines.contains(&extra.to_str().unwrap()));
    assert_eq!(f.record()["effort"], "medium");
}

#[test]
fn the_child_keeps_only_the_listed_environment_and_a_five_minute_cache() {
    let f = Fixture::new();
    f.fake_stream(&[result_event(findings())]);
    f.command()
        .env("MIDNA_SESSION", "dropped")
        .env("CLAUDE_AUTOCOMPACT_PCT_OVERRIDE", "dropped")
        .env("CLAUDE_CODE_AUTO_COMPACT_WINDOW", "dropped")
        .env("ANTHROPIC_BASE_URL", "http://kept.test")
        .output()
        .unwrap();
    let env = f.captured("env");
    assert!(env.contains("CLAUDE_CODE_PROMPT_CACHE_TTL=5m"), "{env}");
    assert!(env.contains("ANTHROPIC_BASE_URL=http://kept.test"), "{env}");
    assert!(!env.contains("dropped"), "{env}");
    assert!(!env.contains("ULTRAHAND_CLAUDE"), "{env}");
}

#[test]
fn a_missing_claude_binary_fails_the_run_with_a_record() {
    let f = Fixture::new();
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(1));
    assert!(f.error().contains("could not start"), "{}", f.error());
    assert!(!f.report_path().exists());
    assert_eq!(f.drive_calls(), "");
}

#[test]
fn a_child_that_exits_0_with_no_result_event_fails() {
    let f = Fixture::new();
    f.fake_stream(&[assistant_event()]);
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(1));
    assert!(f.error().contains("no result event"), "{}", f.error());
}

#[test]
fn a_child_that_fails_reports_its_stderr_in_the_record_and_on_one_line() {
    let f = Fixture::new();
    f.fake_claude("echo 'first line' >&2\necho 'second line' >&2\nexit 3");
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(1));
    assert!(f.error().contains("first line"), "{}", f.error());
    let text = stdout(&output);
    assert_eq!(text.lines().count(), 1, "{text}");
    assert!(text.contains("first line second line"), "{text}");
}

#[test]
fn a_success_label_on_an_errored_result_is_a_failure() {
    let f = Fixture::new();
    let mut event = result_event(findings());
    event["is_error"] = json!(true);
    event["terminal_reason"] = json!("rapid_refill_breaker");
    f.fake_stream(&[event]);
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(1));
    assert_eq!(f.error(), "rapid_refill_breaker");
}

#[test]
fn a_line_that_is_not_utf8_does_not_stop_the_run() {
    let f = Fixture::new();
    let good = emit(&result_event(findings()));
    f.fake_claude(&format!(
        "{READ_STDIN}\nprintf '\\377\\376 not text\\n'\n{good}"
    ));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stdout(&output));
}

#[test]
fn spaces_in_every_path_work() {
    let f = Fixture::in_folder("my work folder");
    f.fake_stream(&[result_event(findings())]);
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stdout(&output));
    let args = f.captured("args");
    let quoted = format!(
        "node \"{}\":*",
        f.root.join("shared/input/drive.mjs").display()
    );
    assert!(args.contains(&quoted), "{args}");
    assert!(f.drive_calls().starts_with("close --port "));
}

#[test]
fn a_timeout_stops_the_whole_group_even_a_process_ignoring_term() {
    let f = Fixture::new();
    f.fake_claude(
        r#"sh -c 'trap "" TERM; echo $$ > "$0.stubborn"; while :; do sleep 1; done' "$me" &
until [ -e "$me.stubborn" ]; do :; done
exec sleep 60"#,
    );
    let output = f.run(&["--timeout", FAST_TIMEOUT]);
    assert_eq!(output.status.code(), Some(1));
    assert!(f.error().contains("timed out"), "{}", f.error());

    let claude = pid_in(&f.captured_path("pid"));
    let stubborn = pid_in(&f.captured_path("stubborn"));
    assert!(wait_until(Duration::from_secs(2), || gone(claude) && gone(stubborn)));
    assert!(f.drive_calls().starts_with("close --port "));
}

#[test]
fn a_signal_to_the_command_stops_the_child_and_still_writes_the_record() {
    let f = Fixture::new();
    f.fake_claude("exec sleep 60");
    let mut running = f.command().stdout(Stdio::null()).spawn().unwrap();
    let pid_file = f.captured_path("pid");
    assert!(wait_until(SLOW_START, || pid_file.exists()));
    thread::sleep(Duration::from_millis(100));
    // SAFETY: the pid is this test's own child.
    unsafe { libc::kill(running.id() as i32, libc::SIGTERM) };
    let status = running.wait().unwrap();
    assert_eq!(status.code(), Some(1));
    assert_eq!(f.error(), "interrupted");
    let claude = pid_in(&pid_file);
    assert!(wait_until(Duration::from_secs(2), || gone(claude)));
}

#[test]
fn one_compaction_is_marked_in_the_record_and_the_summary() {
    let f = Fixture::new();
    f.fake_stream(&[compaction_event(), result_event(findings())]);
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stdout(&output));
    assert_eq!(f.record()["compactions"], 1);
    assert_eq!(f.record()["peakContext"], 151_000);
    assert!(stdout(&output).contains("compacted once"));
}

#[test]
fn a_second_compaction_stops_the_child() {
    let f = Fixture::new();
    let boundary = emit(&compaction_event());
    f.fake_claude(&format!("{boundary}\n{boundary}\nexec sleep 60"));
    let started = Instant::now();
    let output = f.run(&[]);
    assert!(started.elapsed() < SLOW_START);
    assert_eq!(output.status.code(), Some(1));
    assert_eq!(f.record()["compactions"], 2);
    assert!(f.error().contains("second compaction"), "{}", f.error());
}

#[test]
fn a_result_without_structured_findings_fails() {
    let f = Fixture::new();
    let mut event = result_event(findings());
    event.as_object_mut().unwrap().remove("structured_output");
    f.fake_stream(&[event]);
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(1));
    assert!(f.error().contains("structured findings"), "{}", f.error());
}

#[test]
fn findings_that_break_the_schema_fail() {
    let f = Fixture::new();
    let mut bad = findings();
    bad["extra"] = json!(true);
    f.fake_stream(&[result_event(bad)]);
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(1));
    assert!(f.error().contains("invalid findings"), "{}", f.error());
    assert_eq!(f.record()["report"], Value::Null);
}

#[test]
fn the_browser_is_closed_on_the_port_the_child_was_told() {
    let f = Fixture::new();
    f.fake_stream(&[result_event(findings())]);
    f.run(&[]);
    let stdin = f.captured("stdin");
    let after_flag = stdin.split("--port ").nth(1).unwrap();
    let port: String = after_flag
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();
    assert_eq!(f.drive_calls().trim(), format!("close --port {port}"));
}

#[test]
fn a_failed_run_with_no_text_leaves_no_old_report_behind() {
    let f = Fixture::new();
    fs::write(f.report_path(), "last round's report").unwrap();
    f.fake_claude("exit 1");
    f.run(&[]);
    assert!(!f.report_path().exists());
}

#[test]
fn bad_usage_exits_2_and_starts_nothing() {
    let f = Fixture::new();
    f.fake_stream(&[result_event(findings())]);
    let output = f.run(&["--timeout", "0"]);
    assert_eq!(output.status.code(), Some(2));
    fs::remove_file(&f.brief).unwrap();
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(2));
    assert!(!f.captured_path("args").exists());
    assert!(!f.out.with_extension("json").exists());
}

#[test]
fn a_brief_bigger_than_the_pipe_does_not_hang_a_child_that_never_reads_it() {
    let f = Fixture::new();
    fs::write(&f.brief, "x".repeat(2_000_000)).unwrap();
    f.fake_claude(&emit(&result_event(findings())));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stdout(&output));
}

#[test]
fn a_process_left_holding_stdout_does_not_hang_the_run() {
    let f = Fixture::new();
    let event = emit(&result_event(findings()));
    f.fake_claude(&format!("{READ_STDIN}\nset -m\nsleep 60 &\n{event}"));
    let started = Instant::now();
    let output = f.run(&[]);
    assert!(started.elapsed() < SLOW_START);
    assert_eq!(output.status.code(), Some(0), "{}", stdout(&output));
}

#[test]
fn stdout_is_one_summary_line_and_never_the_report() {
    let f = Fixture::new();
    f.fake_stream(&[assistant_event(), result_event(findings())]);
    let text = stdout(&f.run(&[]));
    assert_eq!(text.lines().count(), 1, "{text}");
    assert!(text.starts_with("review: "), "{text}");
    assert!(text.contains("opus · 2 turns · 3s · $0.12"), "{text}");
    assert!(!text.contains("Low contrast"), "{text}");
}

#[test]
fn an_out_flag_names_both_files() {
    let f = Fixture::new();
    f.fake_stream(&[result_event(findings())]);
    let out = f.base.join("elsewhere/custom.v2");
    let output = f.run(&["--out", out.to_str().unwrap()]);
    assert_eq!(output.status.code(), Some(0), "{}", stdout(&output));
    assert!(f.base.join("elsewhere/custom.v2.md").exists());
    assert!(f.base.join("elsewhere/custom.v2.json").exists());
}
