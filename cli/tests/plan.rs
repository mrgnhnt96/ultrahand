use std::fs::{self, File};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use image::{GenericImageView, RgbImage};
use serde_json::{Value, json};
use tempfile::TempDir;

/// A script written a moment ago can take seconds to start on macOS when many start at once,
/// so every limit here leaves room for that.
const SLOW_START: Duration = Duration::from_secs(30);

const FAKE_DRIVE: &str = r#"
import { appendFileSync } from 'node:fs';
appendFileSync(new URL('./calls', import.meta.url), process.argv.slice(2).join(' ') + '\n');
"#;

fn finding(id: &str, severity: u8, title: &str) -> Value {
    json!({
        "id": id, "severity": severity, "title": title, "element": "Search › hint",
        "evidence": "Confirmed", "problem": "Hard to read", "principle": "WCAG 1.4.3",
        "fix": "Raise to #595959",
    })
}

fn report(verdict: &str, findings: Value) -> Value {
    json!({
        "verdict": verdict, "findings": findings,
        "what_works": ["Clear focus"], "not_checked": ["Dark mode"],
    })
}

fn result_event(structured: &Value) -> Value {
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

fn assistant_line() -> String {
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
    .to_string()
}

struct Fixture {
    _dir: TempDir,
    base: PathBuf,
    root: PathBuf,
    home: PathBuf,
    claude: PathBuf,
    plan: PathBuf,
    out: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let dir = TempDir::new().unwrap();
        let base = fs::canonicalize(dir.path()).unwrap();
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
        let home = base.join("home");
        fs::create_dir_all(&home).unwrap();
        fs::create_dir_all(base.join("replies")).unwrap();
        fs::create_dir_all(base.join("seen")).unwrap();
        fs::create_dir_all(base.join("src")).unwrap();
        fs::write(base.join("src/search.rs"), "fn search() {}\n").unwrap();
        let fixture = Fixture {
            plan: base.join("plan.json"),
            out: base.join("reviews"),
            claude: base.join("fake-claude"),
            _dir: dir,
            base,
            root,
            home,
        };
        fixture.fake_claude("");
        fixture
    }

    /// Records what each child was given under seen/<unit>, runs `before`, then prints
    /// replies/<unit> as its stream.
    fn fake_claude(&self, before: &str) {
        let script = format!(
            r#"#!/bin/sh
dir='{}'
input=$(cat)
unit=$(printf '%s\n' "$input" | sed -n 's/^# Review unit: //p' | head -n 1)
seen="$dir/seen/$unit"
mkdir -p "$seen"
printf '%s' "$input" > "$seen/stdin"
printf '%s\n' "$@" > "$seen/args"
here=$(pwd)
echo "$here" > "$seen/cwd"
ls > "$seen/files"
cat captures.txt > "$seen/index"
for file in *.png; do [ -e "$file" ] && cp "$file" "$seen/"; done
echo "$$" > "$seen/pid"
{before}
cat "$dir/replies/$unit"
"#,
            self.base.display()
        );
        fs::write(&self.claude, script).unwrap();
        fs::set_permissions(&self.claude, fs::Permissions::from_mode(0o755)).unwrap();
    }

    fn reply_lines(&self, unit: &str, lines: &[String]) {
        fs::write(
            self.base.join("replies").join(unit),
            lines.join("\n") + "\n",
        )
        .unwrap();
    }

    fn reply(&self, unit: &str, report: &Value) {
        self.reply_lines(unit, &[assistant_line(), result_event(report).to_string()]);
    }

    fn reply_ok(&self, unit: &str) {
        self.reply(unit, &report("Fine.", json!([])));
    }

    fn write_plan(&self, plan: &Value) {
        fs::write(&self.plan, plan.to_string()).unwrap();
    }

    fn write_units(&self, units: Value) {
        self.write_plan(&json!({
            "version": 1, "profile": "review", "platform": "desktop",
            "users": "Daily users", "primary_task": "Find a task", "units": units,
        }));
    }

    /// Plain units with code only, each with a passing reply.
    fn simple_units(&self, names: &[&str]) {
        let units: Vec<Value> = names
            .iter()
            .map(|name| {
                self.reply_ok(name);
                json!({ "name": name, "scope": "The screen", "code": ["src/search.rs"] })
            })
            .collect();
        self.write_units(json!(units));
    }

    fn png(&self, rel: &str, width: u32, height: u32) {
        let path = self.base.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        RgbImage::new(width, height).save(path).unwrap();
    }

    fn command(&self) -> Command {
        let mut command = Command::new(env!("CARGO_BIN_EXE_ultrahand"));
        command
            .current_dir(&self.base)
            .arg("review")
            .arg("--plugin-root")
            .arg(&self.root)
            .env("ULTRAHAND_CLAUDE", &self.claude)
            .env("HOME", &self.home)
            .env_remove("XDG_CACHE_HOME")
            .env_remove("ULTRAHAND_MAX_CHILDREN");
        command
    }

    fn plan_command(&self) -> Command {
        let mut command = self.command();
        command
            .arg("--plan")
            .arg(&self.plan)
            .arg("--out")
            .arg(&self.out);
        command
    }

    fn run(&self, extra: &[&str]) -> Output {
        self.plan_command().args(extra).output().unwrap()
    }

    fn cache(&self) -> PathBuf {
        let cache = if cfg!(target_os = "macos") {
            "Library/Caches"
        } else {
            ".cache"
        };
        self.home.join(cache).join("ultrahand")
    }

    fn hold_slot(&self, slot: usize) -> File {
        let folder = self.cache().join("slots");
        fs::create_dir_all(&folder).unwrap();
        let file = File::create(folder.join(format!("slot-{slot}.lock"))).unwrap();
        file.try_lock().unwrap();
        file
    }

    fn seen(&self, unit: &str, what: &str) -> String {
        fs::read_to_string(self.base.join("seen").join(unit).join(what)).unwrap()
    }

    fn was_run(&self, unit: &str) -> bool {
        self.base.join("seen").join(unit).exists()
    }

    fn merged(&self) -> Value {
        let text = fs::read_to_string(self.out.join("findings.json")).unwrap();
        serde_json::from_str(&text).unwrap()
    }

    fn merged_report(&self) -> String {
        fs::read_to_string(self.out.join("report.md")).unwrap()
    }

    fn unit_record(&self, slug: &str) -> Value {
        let path = self.out.join("units").join(format!("{slug}.json"));
        serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
    }

    fn drive_calls(&self) -> String {
        fs::read_to_string(self.root.join("shared/input/calls")).unwrap_or_default()
    }
}

fn stdout(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

fn stderr(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).into_owned()
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

fn start(mut command: Command) -> Child {
    command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap()
}

fn after<'a>(args: &'a str, name: &str) -> Vec<&'a str> {
    let lines: Vec<&str> = args.lines().collect();
    lines
        .windows(2)
        .filter(|pair| pair[0] == name)
        .map(|pair| pair[1])
        .collect()
}

#[test]
fn a_plan_merges_its_units_by_severity_and_flow_order() {
    let f = Fixture::new();
    f.simple_units(&["Search empty", "Search results"]);
    f.reply(
        "Search empty",
        &report(
            "Ship after R1.",
            json!([finding("R1", 2, "Small"), finding("R2", 3, "Bigger")]),
        ),
    );
    f.reply(
        "Search results",
        &report("Blocked by R1.", json!([finding("R1", 4, "Worst")])),
    );

    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
    assert_eq!(
        stdout(&output).trim(),
        format!(
            "{} · 4 Catastrophe 1 · 3 Major 1 · 2 Minor 1 · 1 Cosmetic 0",
            f.out.join("findings.json").display()
        )
    );

    let merged = f.merged();
    assert_eq!(merged["version"], 1);
    let findings = merged["findings"].as_array().unwrap();
    let order: Vec<(&str, &str, &str)> = findings
        .iter()
        .map(|finding| {
            (
                finding["id"].as_str().unwrap(),
                finding["title"].as_str().unwrap(),
                finding["unit"].as_str().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        order,
        [
            ("R1", "Worst", "Search results"),
            ("R2", "Bigger", "Search empty"),
            ("R3", "Small", "Search empty"),
        ]
    );
    assert_eq!(merged["units"][0]["status"], "ok");
    assert_eq!(merged["units"][0]["findings"], 2);
    assert_eq!(merged["units"][0]["verdict"], "Ship after R3.");
    assert_eq!(merged["what_works"][1], "Search results: Clear focus");
    assert_eq!(merged["not_checked"][0], "Search empty: Dark mode");

    let text = f.merged_report();
    assert!(text.contains("### R1 · 4 Catastrophe · Worst\n- **Unit:** Search results\n"));
    assert!(text.contains("- **Search empty:** 2 findings. Ship after R3.\n"));

    assert_eq!(f.unit_record("search-empty")["unit"], "Search empty");
    assert_eq!(
        f.unit_record("search-empty")["report"]["findings"][0]["id"],
        "R1"
    );
    assert!(f.out.join("units/search-results.md").is_file());
}

#[test]
fn a_child_is_told_its_unit_and_cannot_ask() {
    let f = Fixture::new();
    f.reply_ok("search");
    f.png("shots/empty.png", 100, 80);
    f.write_plan(&json!({
        "version": 1, "platform": "desktop", "users": "Run users", "primary_task": "Run task",
        "units": [{
            "name": "search", "scope": "The empty state", "users": "Unit users",
            "code": ["src/search.rs"], "captures": [{ "path": "shots/empty.png" }],
        }],
    }));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));

    let message = f.seen("search", "stdin");
    assert!(message.contains("Platform: desktop\n"), "{message}");
    assert!(message.contains("Users: Unit users\n"), "{message}");
    assert!(message.contains("Primary task: Run task\n"), "{message}");
    assert!(message.contains("Scope: The empty state\n"), "{message}");
    let code = f.base.join("src/search.rs");
    assert!(message.contains(&format!("- {}\n", code.display())));
    assert!(message.contains("under not_checked"), "{message}");
    assert!(message.contains("one per read"), "{message}");
    assert!(message.contains("by its file name"), "{message}");

    let args = f.seen("search", "args");
    assert!(!after(&args, "--tools")[0].contains("Ask"));
    let prompt = after(&args, "--system-prompt-file")[0];
    let prompt = fs::read_to_string(prompt).unwrap();
    assert!(prompt.contains("Never ask a question"), "{prompt}");
}

#[test]
fn children_differ_only_in_their_staged_folder_and_port() {
    let f = Fixture::new();
    f.simple_units(&["one", "two"]);
    f.run(&[]);
    let (one, two) = (f.seen("one", "args"), f.seen("two", "args"));
    let (cwd_one, cwd_two) = (f.seen("one", "cwd"), f.seen("two", "cwd"));
    assert_ne!(cwd_one, cwd_two);
    assert_eq!(
        one.replace(cwd_one.trim(), "STAGED"),
        two.replace(cwd_two.trim(), "STAGED")
    );
    let dirs = after(&one, "--add-dir");
    let code_root = f.base.join("src");
    assert_eq!(
        dirs,
        [
            f.root.to_str().unwrap(),
            cwd_one.trim(),
            code_root.to_str().unwrap(),
        ]
    );

    let port = |unit: &str| {
        let message = f.seen(unit, "stdin");
        let at = message.find("--port ").unwrap() + "--port ".len();
        message[at..].split_whitespace().next().unwrap().to_owned()
    };
    assert_ne!(port("one"), port("two"));
    let calls = f.drive_calls();
    assert!(
        calls.contains(&format!("close --port {}", port("one"))),
        "{calls}"
    );
    assert!(
        calls.contains(&format!("close --port {}", port("two"))),
        "{calls}"
    );
}

#[test]
fn a_child_gets_only_its_own_captures_scaled_with_an_index() {
    let f = Fixture::new();
    f.reply_ok("big");
    f.reply_ok("other");
    f.png("shots/wide.png", 2000, 1000);
    f.png("shots/small.png", 300, 200);
    f.png("shots/theirs.png", 300, 200);
    f.write_units(json!([
        {
            "name": "big", "scope": "s",
            "captures": [
                { "path": "shots/wide.png", "state": "empty", "theme": "dark", "size": "1360x860" },
                { "path": "shots/small.png" },
            ],
        },
        { "name": "other", "scope": "s", "captures": [{ "path": "shots/theirs.png" }] },
    ]));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));

    assert_eq!(
        f.seen("big", "files"),
        "captures.txt\nsmall.png\nwide.png\n"
    );
    assert_eq!(
        f.seen("big", "index"),
        "wide.png | empty | dark | 1360x860\n\
         small.png | not given | not given | 300x200\n"
    );
    let staged = image::open(f.base.join("seen/big/wide.png")).unwrap();
    assert_eq!(staged.dimensions(), (1568, 784));
    assert_eq!(f.seen("other", "files"), "captures.txt\ntheirs.png\n");

    assert!(!Path::new(f.seen("big", "cwd").trim()).exists());
    assert!(!Path::new(f.seen("other", "cwd").trim()).exists());
    assert!(f.base.join("shots/wide.png").exists());
}

#[test]
fn a_unit_over_the_image_budget_is_refused_by_name_before_anything_starts() {
    let f = Fixture::new();
    f.reply_ok("fine");
    let captures: Vec<Value> = (0..17)
        .map(|n| {
            let path = format!("shots/{n}.png");
            f.png(&path, 10, 10);
            json!({ "path": path })
        })
        .collect();
    f.write_units(json!([
        { "name": "fine", "scope": "s", "code": ["src/search.rs"] },
        { "name": "whole group", "scope": "s", "captures": captures },
    ]));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(2));
    let error = stderr(&output);
    assert!(error.contains("whole group"), "{error}");
    assert!(error.contains("17 captures"), "{error}");
    assert!(!f.was_run("fine"));
    assert!(!f.out.exists());
}

#[test]
fn a_unit_over_the_code_budget_is_refused_by_name() {
    let f = Fixture::new();
    fs::create_dir_all(f.base.join("src/big/deep")).unwrap();
    fs::write(f.base.join("src/big/one.rs"), vec![b'x'; 40 * 1024]).unwrap();
    fs::write(f.base.join("src/big/deep/two.rs"), vec![b'x'; 40 * 1024]).unwrap();
    f.write_units(json!([{ "name": "huge", "scope": "s", "code": ["src/big"] }]));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(2));
    let error = stderr(&output);
    assert!(error.contains("huge"), "{error}");
    assert!(error.contains("81920 bytes of code"), "{error}");
}

#[test]
fn every_problem_in_a_plan_is_reported_at_once() {
    let f = Fixture::new();
    fs::write(f.base.join("not-an-image.png"), "text").unwrap();
    f.png("a/same.png", 10, 10);
    f.png("b/same.png", 10, 10);
    f.write_plan(&json!({
        "version": 1,
        "units": [
            { "name": "no settings", "scope": " ", "code": ["src/missing.rs"] },
            { "name": "web", "scope": "s", "platform": "web", "users": "u", "primary_task": "t",
              "captures": [
                  { "path": "https://example.com/a.png" },
                  { "path": "data:image/png;base64,AAAA" },
                  { "path": "not-an-image.png" },
                  { "path": "gone.png" },
              ] },
            { "name": "empty", "scope": "s", "platform": "web", "users": "u", "primary_task": "t" },
            { "name": "twins", "scope": "s", "platform": "web", "users": "u", "primary_task": "t",
              "captures": [{ "path": "a/same.png" }, { "path": "b/same.png" }] },
            { "name": "Twins!", "scope": "s", "platform": "web", "users": "u", "primary_task": "t",
              "code": ["src/search.rs"] },
            { "name": "...", "scope": "s", "platform": "web", "users": "u", "primary_task": "t",
              "code": ["src/search.rs"] },
        ],
    }));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(2));
    let error = stderr(&output);
    for expected in [
        "\"no settings\": the scope is empty",
        "\"no settings\": no platform",
        "\"no settings\": no users",
        "\"no settings\": no primary_task",
        "code src/missing.rs",
        "https://example.com/a.png: captures come only from local files",
        "data:image/png;base64,AAAA: captures come only from local files",
        "not-an-image.png: not a PNG, JPEG or WebP image",
        "gone.png: no such file",
        "\"empty\": no code and no captures",
        "two captures are named same.png",
        "units \"twins\" and \"Twins!\" would write the same file",
        "\"...\": the name needs a letter or a digit",
    ] {
        assert!(error.contains(expected), "{expected}\n{error}");
    }
}

#[test]
fn a_plan_with_an_unknown_field_version_or_profile_is_refused() {
    let f = Fixture::new();
    for plan in [
        json!({ "version": 2, "units": [] }),
        json!({ "version": 1, "extra": true, "units": [] }),
        json!({ "version": 1, "profile": "theme-review", "units": [] }),
        json!({ "version": 1, "units": [] }),
    ] {
        f.write_plan(&plan);
        let output = f.run(&[]);
        assert_eq!(output.status.code(), Some(2), "{plan}");
    }
    fs::write(&f.plan, "not json").unwrap();
    assert_eq!(f.run(&[]).status.code(), Some(2));
}

#[test]
fn a_unit_with_no_captures_runs_and_says_so() {
    let f = Fixture::new();
    f.simple_units(&["code only"]);
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
    assert_eq!(f.seen("code only", "files"), "captures.txt\n");
    assert_eq!(f.seen("code only", "index"), "");
    assert!(f.seen("code only", "stdin").contains("None were supplied"));
    let not_checked = f.merged()["not_checked"].to_string();
    assert!(
        not_checked.contains("code only: no captures were supplied"),
        "{not_checked}"
    );
}

#[test]
fn a_child_returning_invalid_json_fails_its_unit_and_the_rest_still_merge() {
    let f = Fixture::new();
    f.simple_units(&["good", "bad schema", "bad stream"]);
    f.reply(
        "good",
        &report("Ship after R1.", json!([finding("R1", 2, "Small")])),
    );
    f.reply("bad schema", &json!({ "verdict": "No lists" }));
    f.reply_lines("bad stream", &["{ not json".to_owned()]);

    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(1));
    assert!(
        stdout(&output).contains("· 2 failed"),
        "{}",
        stdout(&output)
    );

    let merged = f.merged();
    assert_eq!(merged["findings"].as_array().unwrap().len(), 1);
    assert_eq!(merged["units"][1]["status"], "failed");
    assert_eq!(merged["units"][1]["findings"], 0);
    let reason = merged["units"][1]["reason"].as_str().unwrap();
    assert!(reason.contains("invalid findings"), "{reason}");
    let not_checked = merged["not_checked"].to_string();
    assert!(not_checked.contains("bad schema: not reviewed: invalid findings"));
    assert!(not_checked.contains("bad stream: not reviewed: "));
    assert!(f.merged_report().contains("## Not checked"));
}

#[test]
fn a_child_that_cannot_start_fails_its_unit() {
    let f = Fixture::new();
    f.simple_units(&["one"]);
    let output = f
        .plan_command()
        .env("ULTRAHAND_CLAUDE", f.base.join("no-such-claude"))
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(
        f.merged()["units"][0]["reason"]
            .as_str()
            .unwrap()
            .contains("could not start")
    );
}

#[test]
fn a_capture_that_cannot_be_scaled_fails_its_unit() {
    let f = Fixture::new();
    f.reply_ok("broken");
    f.png("shots/cut.png", 2000, 1000);
    let path = f.base.join("shots/cut.png");
    let header = fs::read(&path).unwrap()[..64].to_vec();
    fs::write(&path, header).unwrap();
    f.write_units(json!([
        { "name": "broken", "scope": "s", "captures": [{ "path": "shots/cut.png" }] },
    ]));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(1), "{}", stderr(&output));
    assert!(!f.was_run("broken"));
    let reason = f.merged()["units"][0]["reason"].to_string();
    assert!(reason.contains("can't stage cut.png"), "{reason}");
}

#[test]
fn only_reruns_the_named_unit_and_merges_with_the_earlier_results() {
    let f = Fixture::new();
    f.simple_units(&["first", "second"]);
    f.reply(
        "first",
        &report("Ship after R1.", json!([finding("R1", 2, "Kept")])),
    );
    f.reply_lines("second", &["{ not json".to_owned()]);
    assert_eq!(f.run(&[]).status.code(), Some(1));

    fs::remove_dir_all(f.base.join("seen/first")).unwrap();
    f.reply(
        "second",
        &report("Blocked by R1.", json!([finding("R1", 4, "Fixed run")])),
    );
    let output = f.run(&["--only", "second"]);
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
    assert!(!f.was_run("first"));

    let merged = f.merged();
    assert_eq!(merged["findings"][0]["title"], "Fixed run");
    assert_eq!(merged["findings"][1]["title"], "Kept");
    assert_eq!(merged["findings"][1]["id"], "R2");
    assert_eq!(merged["units"][0]["verdict"], "Ship after R2.");
}

#[test]
fn only_with_no_earlier_results_reports_the_rest_as_not_run() {
    let f = Fixture::new();
    f.simple_units(&["first", "second"]);
    assert_eq!(f.run(&["--only", "second"]).status.code(), Some(1));
    assert!(!f.was_run("first"));
    assert_eq!(f.merged()["units"][0]["reason"], "not run");
}

#[test]
fn only_with_an_unknown_unit_is_bad_usage() {
    let f = Fixture::new();
    f.simple_units(&["first"]);
    let output = f.run(&["--only", "nope"]);
    assert_eq!(output.status.code(), Some(2));
    assert!(stderr(&output).contains("no unit named nope"));
    assert!(!f.was_run("first"));
}

#[test]
fn a_failed_rerun_does_not_leave_the_old_result_standing() {
    let f = Fixture::new();
    f.simple_units(&["one"]);
    assert_eq!(f.run(&[]).status.code(), Some(0));
    f.reply_lines("one", &["{ not json".to_owned()]);
    assert_eq!(f.run(&[]).status.code(), Some(1));
    assert_eq!(f.merged()["units"][0]["status"], "failed");
    assert!(!f.out.join("units/one.md").exists());
}

#[test]
fn the_rest_start_only_after_the_first_child_replies() {
    let f = Fixture::new();
    f.simple_units(&["a", "b", "c"]);
    f.fake_claude(&format!(
        r#"
if [ "$unit" = a ]; then
    sleep 2
    touch "$dir/replied"
    printf '%s\n' '{}'
    sleep 1
fi
[ -e "$dir/replied" ] || touch "$dir/started-too-early"
"#,
        assistant_line()
    ));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
    assert!(f.was_run("b") && f.was_run("c"));
    assert!(!f.base.join("started-too-early").exists());
}

#[test]
fn the_rest_start_when_the_first_child_fails_without_a_reply() {
    let f = Fixture::new();
    f.simple_units(&["a", "b"]);
    f.reply_lines("a", &["{ not json".to_owned()]);
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(1));
    assert!(f.was_run("b"));
    assert_eq!(f.merged()["units"][1]["status"], "ok");
}

#[test]
fn the_cap_holds_children_back() {
    let f = Fixture::new();
    f.simple_units(&["a", "b", "c"]);
    f.fake_claude(
        r#"
mkdir "$dir/running" || touch "$dir/overlapped"
sleep 0.3
rmdir "$dir/running"
"#,
    );
    let output = f
        .plan_command()
        .env("ULTRAHAND_MAX_CHILDREN", "1")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
    assert!(!f.base.join("overlapped").exists());
    assert_eq!(f.merged()["units"].as_array().unwrap().len(), 3);
}

#[test]
fn a_bad_cap_is_bad_usage() {
    let f = Fixture::new();
    f.simple_units(&["a"]);
    let output = f
        .plan_command()
        .env("ULTRAHAND_MAX_CHILDREN", "0")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(2));
    assert!(stderr(&output).contains("ULTRAHAND_MAX_CHILDREN"));
}

#[test]
fn time_queued_behind_another_run_is_not_counted_toward_the_timeout() {
    let f = Fixture::new();
    f.simple_units(&["a"]);
    let held = f.hold_slot(0);
    let mut command = f.plan_command();
    command
        .args(["--timeout", "0.1"])
        .env("ULTRAHAND_MAX_CHILDREN", "1");
    let run = start(command);
    thread::sleep(Duration::from_secs(7));
    assert!(!f.was_run("a"), "it should still be queued");
    drop(held);
    let output = run.wait_with_output().unwrap();
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
    assert_eq!(f.merged()["units"][0]["status"], "ok");
}

#[test]
fn a_lock_left_by_a_crash_does_not_hold_a_slot() {
    let f = Fixture::new();
    f.simple_units(&["a"]);
    f.fake_claude(&format!(
        r#"[ -e "{0}/second" ] || sleep 60"#,
        f.base.display()
    ));
    let mut command = f.plan_command();
    command.env("ULTRAHAND_MAX_CHILDREN", "1");
    let mut crashed = start(command);
    let pid = f.base.join("seen/a/pid");
    assert!(wait_until(SLOW_START, || {
        fs::read_to_string(&pid).is_ok_and(|text| text.ends_with('\n'))
    }));
    crashed.kill().unwrap();
    crashed.wait().unwrap();
    let group: i32 = f.seen("a", "pid").trim().parse().unwrap();
    // SAFETY: killpg takes plain integers; the crash left this child running.
    unsafe { libc::killpg(group, libc::SIGKILL) };
    assert!(f.cache().join("slots/slot-0.lock").exists());

    fs::write(f.base.join("second"), "").unwrap();
    let output = f
        .plan_command()
        .env("ULTRAHAND_MAX_CHILDREN", "1")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
}

#[test]
fn two_runs_into_one_out_folder_are_refused() {
    let f = Fixture::new();
    f.simple_units(&["a"]);
    f.fake_claude(&format!(
        r#"while [ ! -e "{0}/release" ]; do sleep 0.1; done"#,
        f.base.display()
    ));
    let first = start(f.plan_command());
    assert!(wait_until(SLOW_START, || f.was_run("a")));

    let second = f.run(&[]);
    assert_eq!(second.status.code(), Some(2));
    assert!(stderr(&second).contains("another run is writing to"));

    fs::write(f.base.join("release"), "").unwrap();
    let output = first.wait_with_output().unwrap();
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
}

#[test]
fn a_run_stopped_while_queued_marks_its_units_and_still_merges() {
    let f = Fixture::new();
    f.simple_units(&["a", "b"]);
    let _held = f.hold_slot(0);
    let mut command = f.plan_command();
    command.env("ULTRAHAND_MAX_CHILDREN", "1");
    let run = start(command);
    assert!(wait_until(SLOW_START, || f.out.join("units").is_dir()));
    thread::sleep(Duration::from_millis(500));
    // SAFETY: kill takes plain integers and touches no memory.
    unsafe { libc::kill(run.id() as i32, libc::SIGTERM) };
    let output = run.wait_with_output().unwrap();

    assert_eq!(output.status.code(), Some(1), "{}", stderr(&output));
    assert!(!f.was_run("a") && !f.was_run("b"));
    let merged = f.merged();
    assert_eq!(merged["units"][0]["reason"], "stopped before it started");
    assert_eq!(merged["units"][1]["reason"], "stopped before it started");
}

#[test]
fn a_child_can_read_the_lessons_the_plan_names() {
    let f = Fixture::new();
    f.reply_ok("search");
    fs::create_dir_all(f.base.join("design")).unwrap();
    fs::write(f.base.join("design/LESSONS.md"), "lesson").unwrap();
    f.write_plan(&json!({
        "version": 1, "platform": "desktop", "users": "u", "primary_task": "t",
        "lessons": "design/LESSONS.md",
        "units": [{ "name": "search", "scope": "s", "code": ["src/search.rs"] }],
    }));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));

    let lessons = f.base.join("design/LESSONS.md");
    let message = f.seen("search", "stdin");
    assert!(
        message.contains(&format!("LESSONS.md: {}\n", lessons.display())),
        "{message}"
    );
    let args = f.seen("search", "args");
    let dirs = after(&args, "--add-dir");
    assert!(
        dirs.contains(&f.base.join("design").to_str().unwrap()),
        "{dirs:?}"
    );
}

#[test]
fn a_plan_without_lessons_names_none() {
    let f = Fixture::new();
    f.reply_ok("search");
    f.write_units(json!([{ "name": "search", "scope": "s", "code": ["src/search.rs"] }]));
    let output = f.run(&[]);
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
    assert!(!f.seen("search", "stdin").contains("LESSONS.md"));
}

#[test]
fn lessons_that_are_not_a_file_stop_the_plan() {
    for path in ["design/gone.md", "src"] {
        let f = Fixture::new();
        f.write_plan(&json!({
            "version": 1, "platform": "desktop", "users": "u", "primary_task": "t",
            "lessons": path,
            "units": [{ "name": "search", "scope": "s", "code": ["src/search.rs"] }],
        }));
        let output = f.run(&[]);
        assert_eq!(output.status.code(), Some(2));
        assert!(
            stderr(&output).contains(&format!("lessons {path}")),
            "{}",
            stderr(&output)
        );
    }
}

#[test]
fn a_dry_run_prints_what_would_run_and_touches_nothing() {
    let f = Fixture::new();
    f.png("shots/wide.png", 2000, 1000);
    f.png("shots/small.png", 300, 200);
    f.write_units(json!([
        { "name": "one", "scope": "s",
          "captures": [{ "path": "shots/wide.png" }, { "path": "shots/small.png" }] },
        { "name": "two", "scope": "s", "code": ["src/search.rs"] },
    ]));
    let output = f
        .plan_command()
        .arg("--dry-run")
        .env("ULTRAHAND_CLAUDE", f.base.join("no-such-claude"))
        .env("ULTRAHAND_MAX_CHILDREN", "2")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
    let text = stdout(&output);
    assert!(
        text.contains(&format!("out: {}\n", f.out.display())),
        "{text}"
    );
    assert!(
        text.contains("children: at most 2 on this machine"),
        "{text}"
    );
    assert!(text.contains("unit: one · 2 captures, 1 to scale · 0 bytes of code\n"));
    assert!(text.contains("unit: two · 0 captures, 0 to scale · 15 bytes of code\n"));
    assert!(!f.out.exists());
    assert!(!f.cache().exists());
}

#[test]
fn a_dry_run_refuses_what_a_real_run_would() {
    let f = Fixture::new();
    f.simple_units(&["one"]);
    assert_eq!(
        f.run(&["--dry-run", "--only", "nope"]).status.code(),
        Some(2)
    );
    f.write_units(json!([{ "name": "one", "scope": "s" }]));
    let output = f.run(&["--dry-run"]);
    assert_eq!(output.status.code(), Some(2));
    assert!(stderr(&output).contains("\"one\""));
}

#[test]
fn the_report_folder_defaults_to_design_reviews_under_the_plan_name() {
    let f = Fixture::new();
    f.simple_units(&["one"]);
    let output = f.command().arg("--plan").arg(&f.plan).output().unwrap();
    assert_eq!(output.status.code(), Some(0), "{}", stderr(&output));
    assert!(f.base.join("design/reviews/plan/findings.json").is_file());
    assert!(f.base.join("design/reviews/plan/report.md").is_file());
    assert!(f.base.join("design/reviews/plan/units/one.json").is_file());
}

#[test]
fn plan_flags_only_go_with_a_plan() {
    let f = Fixture::new();
    f.simple_units(&["one"]);
    let brief = f.base.join("brief.md");
    fs::write(&brief, "x").unwrap();
    for extra in [vec!["--only", "one"], vec!["--dry-run"]] {
        let output = f
            .command()
            .arg("--brief")
            .arg(&brief)
            .args(extra)
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(2));
    }
    let both = f.run(&["--brief", brief.to_str().unwrap()]);
    assert_eq!(both.status.code(), Some(2));
    assert_eq!(f.command().output().unwrap().status.code(), Some(2));
    let cwd = f.run(&["--cwd", "."]);
    assert_eq!(cwd.status.code(), Some(2));
}
