use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Condvar, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use crate::child;
use crate::merge::{self, Written};
use crate::plan::{Plan, Unit};
use crate::profile::Profile;
use crate::prompt;
use crate::report;
use crate::review::{self, Done, Job, Record, ReviewArgs};
use crate::slots;
use crate::stage::{self, INDEX_FILE, Staged};

/// The prompt cache is only written once the first child has replied. Starting the rest
/// any sooner has each pay to write it, and a first reply can take longer than this only
/// when something's wrong.
const FIRST_REPLY_LIMIT: Duration = Duration::from_secs(120);
const GATE_TICK: Duration = Duration::from_millis(100);
const NOT_STARTED: &str = "stopped before it started";

#[derive(Default)]
struct GateState {
    open: bool,
    leader_started: Option<Instant>,
}

/// Holds every child but the first until the first has replied. Its limit runs from the
/// first child's start, so time it spends queued isn't counted.
struct Gate {
    state: Mutex<GateState>,
    changed: Condvar,
    limit: Duration,
}

impl Gate {
    fn new(limit: Duration) -> Self {
        Gate {
            state: Mutex::default(),
            changed: Condvar::new(),
            limit,
        }
    }

    fn leader_started(&self) {
        if let Ok(mut state) = self.state.lock() {
            state.leader_started = Some(Instant::now());
        }
    }

    fn open(&self) {
        if let Ok(mut state) = self.state.lock() {
            state.open = true;
        }
        self.changed.notify_all();
    }

    /// False when the run was interrupted while waiting.
    fn wait(&self) -> bool {
        let Ok(mut state) = self.state.lock() else {
            return true;
        };
        loop {
            let timed_out = state
                .leader_started
                .is_some_and(|at| at.elapsed() >= self.limit);
            if state.open || timed_out {
                return true;
            }
            if child::interrupted() {
                return false;
            }
            state = match self.changed.wait_timeout(state, GATE_TICK) {
                Ok((state, _)) => state,
                Err(_) => return true,
            };
        }
    }
}

/// However the first unit ends, nobody stays held behind it.
struct OpensGate<'a>(&'a Gate);

impl Drop for OpensGate<'_> {
    fn drop(&mut self) {
        self.0.open();
    }
}

struct Run<'a> {
    plan_path: PathBuf,
    profile: &'static Profile,
    out: PathBuf,
    system: PathBuf,
    code_root: Option<PathBuf>,
    extra_dirs: Vec<PathBuf>,
    model: String,
    effort: String,
    timeout: f64,
    root: PathBuf,
    slots: PathBuf,
    cap: usize,
    gate: &'a Gate,
}

fn default_out(plan: &Path) -> PathBuf {
    let run = plan.file_stem().unwrap_or_default();
    Path::new("design/reviews").join(run)
}

/// Ok(true) when every unit in the plan finished, Ok(false) when any didn't, Err for bad
/// usage, which is refused before anything starts.
pub fn run(plan_path: &Path, args: ReviewArgs) -> Result<bool, String> {
    let plan = Plan::load(plan_path)?;
    let selected = plan.select(&args.only)?;
    let cap = slots::max_children()?;
    let root = review::plugin_root(args.plugin_root.as_deref())?;
    let text =
        prompt::system_prompt(&root, plan.profile).map_err(|e| format!("plugin root: {e}"))?;
    let extra_dirs = args
        .add_dirs
        .iter()
        .map(|dir| review::existing_folder(dir))
        .collect::<Result<Vec<_>, _>>()?;
    let out = args.out.clone().unwrap_or_else(|| default_out(plan_path));
    let out = review::absolute(&out)?;
    if args.dry_run {
        print_dry_run(&selected, &out, cap, &args);
        return Ok(true);
    }

    let cache = slots::cache_dir()?;
    let slot_folder = cache.join("slots");
    fs::create_dir_all(&slot_folder).map_err(|e| format!("{}: {e}", slot_folder.display()))?;
    let units_folder = out.join(merge::UNITS_FOLDER);
    fs::create_dir_all(&units_folder).map_err(|e| format!("{}: {e}", out.display()))?;
    let _out_lock = slots::hold_out_folder(&cache, &out)?;
    for unit in &selected {
        let base = merge::unit_path(&out, unit);
        review::remove_results(&base).map_err(|e| format!("{}: {e}", base.display()))?;
    }
    let system = prompt::write_system_prompt(&text, &env::temp_dir())
        .map_err(|e| format!("system prompt: {e}"))?;
    let ports = review::free_ports(selected.len())?;

    let gate = Gate::new(FIRST_REPLY_LIMIT);
    let run = Run {
        plan_path: review::absolute(plan_path)?,
        profile: plan.profile,
        out,
        system,
        code_root: plan.code_root(),
        extra_dirs,
        model: args.model,
        effort: args.effort,
        timeout: args.timeout,
        root,
        slots: slot_folder,
        cap,
        gate: &gate,
    };
    thread::scope(|scope| {
        for (index, (unit, port)) in selected.iter().zip(ports).enumerate() {
            let run = &run;
            scope.spawn(move || run.review_unit(unit, port, index == 0));
        }
    });
    finish(&plan, &run.out)
}

fn finish(plan: &Plan, out: &Path) -> Result<bool, String> {
    match merge::write(plan, out) {
        Ok(written) => {
            let _ = writeln!(io::stdout(), "{}", summary_line(&written));
            Ok(written.failed == 0)
        }
        Err(error) => {
            eprintln!("ultrahand: can't write the merged report: {error}");
            Ok(false)
        }
    }
}

fn summary_line(written: &Written) -> String {
    let mut parts = vec![written.path.display().to_string()];
    for severity in (1..=4).rev() {
        let count = written.counts[usize::from(severity) - 1];
        parts.push(format!("{} {count}", report::severity_label(severity)));
    }
    if written.failed > 0 {
        parts.push(format!("{} failed", written.failed));
    }
    parts.join(" · ")
}

fn print_dry_run(selected: &[&Unit], out: &Path, cap: usize, args: &ReviewArgs) {
    let mut lines = vec![
        format!("out: {}", out.display()),
        format!(
            "children: at most {cap} on this machine · {} · {} min each",
            args.model, args.timeout
        ),
    ];
    for unit in selected {
        let scaled = unit
            .captures
            .iter()
            .filter(|capture| stage::needs_scaling(capture))
            .count();
        lines.push(format!(
            "unit: {} · {} captures, {scaled} to scale · {} bytes of code",
            unit.name,
            unit.captures.len(),
            unit.code_bytes,
        ));
    }
    let _ = writeln!(io::stdout(), "{}", lines.join("\n"));
}

fn unit_message(unit: &Unit, staged: &Staged, root: &Path, port: u16) -> Vec<u8> {
    let code: String = unit
        .code
        .iter()
        .map(|path| format!("- {}\n", path.display()))
        .collect();
    let code = if code.is_empty() {
        "None given.\n".to_owned()
    } else {
        code
    };
    let captures = if unit.captures.is_empty() {
        "None were supplied. Say so under not_checked for anything that needs them.".to_owned()
    } else {
        format!(
            "{} files in {}, listed in {INDEX_FILE} as name | state | theme | size. Each file \
             is one image: read them one at a time, one per read, and refer to a capture by \
             its file name in the report.",
            unit.captures.len(),
            staged.path.display(),
        )
    };
    let text = format!(
        "# Review unit: {}\n\nPlatform: {}\nUsers: {}\nPrimary task: {}\n\nScope: {}\n\nCode:\n\
         {code}\nCaptures: {captures}\n\nNobody can answer a question in this run. Anything \
         you don't know or can't reach goes under not_checked.{}",
        unit.name,
        unit.platform,
        unit.users,
        unit.primary_task,
        unit.scope,
        review::browser_note(root, port),
    );
    text.into_bytes()
}

impl Run<'_> {
    fn review_unit(&self, unit: &Unit, port: u16, leader: bool) {
        let _opens = leader.then(|| OpensGate(self.gate));
        let (record, markdown) = match self.attempt(unit, port, leader) {
            Ok(done) => (done.record, done.markdown),
            Err(reason) => (self.not_started(unit, reason), None),
        };
        let base = merge::unit_path(&self.out, unit);
        if let Err(error) = review::write_outputs(&base, &record, markdown.as_deref()) {
            eprintln!("ultrahand: can't write {}: {error}", base.display());
        }
    }

    /// The slot is taken before staging so queued units hold no scaled images, and kept
    /// until the child and its browser are gone.
    fn attempt(&self, unit: &Unit, port: u16, leader: bool) -> Result<Done, String> {
        if !leader && !self.gate.wait() {
            return Err(NOT_STARTED.to_owned());
        }
        let Some(_slot) = slots::take_slot(&self.slots, self.cap)? else {
            return Err(NOT_STARTED.to_owned());
        };
        let staged = stage::stage(unit)?;
        if leader {
            self.gate.leader_started();
        }
        let job = self.job(unit, port, &staged);
        Ok(review::review(&job, &self.system, || {
            if leader {
                self.gate.open();
            }
        }))
    }

    fn job(&self, unit: &Unit, port: u16, staged: &Staged) -> Job {
        let mut add_dirs = vec![staged.path.clone()];
        add_dirs.extend(self.code_root.clone());
        add_dirs.extend(self.extra_dirs.iter().cloned());
        Job {
            brief_path: self.plan_path.clone(),
            unit: Some(unit.name.clone()),
            profile: self.profile,
            message: unit_message(unit, staged, &self.root, port),
            out: merge::unit_path(&self.out, unit),
            cwd: staged.path.clone(),
            add_dirs,
            model: self.model.clone(),
            effort: self.effort.clone(),
            timeout_minutes: self.timeout,
            root: self.root.clone(),
            port,
        }
    }

    fn not_started(&self, unit: &Unit, reason: String) -> Record {
        Record::not_started(
            self.plan_path.clone(),
            unit.name.clone(),
            self.model.clone(),
            reason,
        )
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};

    use super::*;

    #[test]
    fn the_gate_holds_until_the_first_reply() {
        let gate = Gate::new(Duration::from_secs(60));
        let passed = AtomicBool::new(false);
        thread::scope(|scope| {
            scope.spawn(|| {
                assert!(gate.wait());
                passed.store(true, Ordering::SeqCst);
            });
            gate.leader_started();
            thread::sleep(Duration::from_millis(250));
            assert!(!passed.load(Ordering::SeqCst));
            gate.open();
        });
        assert!(passed.load(Ordering::SeqCst));
    }

    #[test]
    fn the_gate_gives_up_at_its_limit_counted_from_the_leaders_start() {
        let gate = Gate::new(Duration::from_millis(200));
        let passed = AtomicBool::new(false);
        thread::scope(|scope| {
            scope.spawn(|| {
                gate.wait();
                passed.store(true, Ordering::SeqCst);
            });
            thread::sleep(Duration::from_millis(400));
            assert!(!passed.load(Ordering::SeqCst), "still queued, so no limit");
            gate.leader_started();
        });
        assert!(passed.load(Ordering::SeqCst));
    }

    #[test]
    fn the_default_out_folder_is_named_after_the_plan() {
        assert_eq!(
            default_out(Path::new("plans/search.json")),
            Path::new("design/reviews/search")
        );
    }
}
