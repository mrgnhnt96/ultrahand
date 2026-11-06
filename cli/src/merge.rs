use std::cmp::Reverse;
use std::collections::HashMap;
use std::fmt::Write;
use std::fs;
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::plan::{Plan, Unit};
use crate::profile::Profile;
use crate::report::{self, Finding, Report};
use crate::review::{one_line, with_suffix};

pub const FINDINGS_FILE: &str = "findings.json";
pub const REPORT_FILE: &str = "report.md";
pub const UNITS_FOLDER: &str = "units";

const VERSION: u32 = 1;
const NOT_RUN: &str = "not run";

#[derive(Deserialize)]
struct UnitRecord {
    ok: bool,
    error: Option<String>,
    report: Option<Value>,
}

enum Outcome {
    Finished(Report),
    Failed(String),
}

#[derive(Serialize)]
struct UnitLine {
    name: String,
    status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    verdict: Option<String>,
    findings: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
}

#[derive(Serialize)]
struct UnitFinding {
    unit: String,
    #[serde(flatten)]
    finding: Finding,
}

#[derive(Serialize)]
struct Merged {
    version: u32,
    units: Vec<UnitLine>,
    findings: Vec<UnitFinding>,
    what_works: Vec<String>,
    not_checked: Vec<String>,
}

pub struct Written {
    pub path: PathBuf,
    /// Findings at severity 1 to 4, in that order.
    pub counts: [usize; 4],
    pub failed: usize,
}

pub fn unit_path(out: &Path, unit: &Unit) -> PathBuf {
    out.join(UNITS_FOLDER).join(&unit.slug)
}

/// Reads every unit in the plan from disk, not just the ones this run started, so a rerun
/// with --only merges into what the earlier run left.
pub fn write(plan: &Plan, out: &Path) -> io::Result<Written> {
    let outcomes = plan
        .units
        .iter()
        .map(|unit| read_outcome(&unit_path(out, unit), plan.profile))
        .collect();
    let merged = merge(&plan.units, outcomes);
    let path = out.join(FINDINGS_FILE);
    let json = serde_json::to_string_pretty(&merged)?;
    fs::write(&path, json + "\n")?;
    fs::write(out.join(REPORT_FILE), merged.to_markdown())?;
    let mut counts = [0; 4];
    for entry in &merged.findings {
        counts[usize::from(entry.finding.severity) - 1] += 1;
    }
    let failed = merged.units.iter().filter(|u| u.reason.is_some()).count();
    Ok(Written {
        path,
        counts,
        failed,
    })
}

fn read_outcome(base: &Path, profile: &Profile) -> Outcome {
    let text = match fs::read_to_string(with_suffix(base, ".json")) {
        Ok(text) => text,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Outcome::Failed(NOT_RUN.to_owned());
        }
        Err(error) => return Outcome::Failed(format!("can't read its result: {error}")),
    };
    match parse_outcome(&text, profile) {
        Ok(outcome) => outcome,
        Err(error) => Outcome::Failed(format!("its result is invalid: {error}")),
    }
}

fn parse_outcome(text: &str, profile: &Profile) -> Result<Outcome, String> {
    let record: UnitRecord = serde_json::from_str(text).map_err(|e| e.to_string())?;
    if !record.ok {
        let reason = record.error.unwrap_or_else(|| "failed".to_owned());
        return Ok(Outcome::Failed(reason));
    }
    let report = record.report.ok_or("it holds no report")?;
    (profile.parse)(&report).map(Outcome::Finished)
}

/// Mechanical on purpose: severity, then plan order, then the child's own order. Judging
/// duplicates and the final ranking stay with the caller.
fn merge(units: &[Unit], mut outcomes: Vec<Outcome>) -> Merged {
    let mut ranked: Vec<(usize, Finding)> = Vec::new();
    for (index, outcome) in outcomes.iter_mut().enumerate() {
        if let Outcome::Finished(report) = outcome {
            let findings = std::mem::take(&mut report.findings);
            ranked.extend(findings.into_iter().map(|finding| (index, finding)));
        }
    }
    ranked.sort_by_key(|(index, finding)| (Reverse(finding.severity), *index));

    let mut ids: Vec<HashMap<String, String>> = vec![HashMap::new(); units.len()];
    for (position, (index, finding)) in ranked.iter().enumerate() {
        ids[*index]
            .entry(finding.id.clone())
            .or_insert_with(|| format!("R{}", position + 1));
    }

    let mut merged = Merged {
        version: VERSION,
        units: Vec::new(),
        findings: Vec::new(),
        what_works: Vec::new(),
        not_checked: Vec::new(),
    };
    for (index, (unit, outcome)) in units.iter().zip(outcomes).enumerate() {
        let count = ranked.iter().filter(|(owner, _)| *owner == index).count();
        merged.add_unit(unit, outcome, count, &ids[index]);
    }
    for (position, (index, mut finding)) in ranked.into_iter().enumerate() {
        finding.rewrite_text(|text| rewrite_ids(text, &ids[index]));
        finding.id = format!("R{}", position + 1);
        merged.findings.push(UnitFinding {
            unit: units[index].name.clone(),
            finding,
        });
    }
    merged
}

/// A child's report mentions its own ids, as in "Ship after R1", and those have to follow
/// the renumbering. One pass, so a new id can't be rewritten again.
fn rewrite_ids(text: &str, ids: &HashMap<String, String>) -> String {
    text.split_inclusive(|c: char| !c.is_alphanumeric())
        .map(|piece| {
            let word = piece.trim_end_matches(|c: char| !c.is_alphanumeric());
            match ids.get(word) {
                Some(id) => format!("{id}{}", &piece[word.len()..]),
                None => piece.to_owned(),
            }
        })
        .collect()
}

impl Merged {
    fn add_unit(
        &mut self,
        unit: &Unit,
        outcome: Outcome,
        findings: usize,
        ids: &HashMap<String, String>,
    ) {
        let name = &unit.name;
        let labelled = |text: &String| format!("{name}: {}", rewrite_ids(text, ids));
        match outcome {
            Outcome::Finished(report) => {
                self.what_works
                    .extend(report.what_works.iter().map(labelled));
                self.not_checked
                    .extend(report.not_checked.iter().map(labelled));
                if unit.captures.is_empty() {
                    self.not_checked
                        .push(format!("{name}: no captures were supplied"));
                }
                self.units.push(UnitLine {
                    name: name.clone(),
                    status: "ok",
                    verdict: Some(rewrite_ids(&report.verdict, ids)),
                    findings,
                    reason: None,
                });
            }
            Outcome::Failed(reason) => {
                let reason = one_line(&reason);
                self.not_checked
                    .push(format!("{name}: not reviewed: {reason}"));
                self.units.push(UnitLine {
                    name: name.clone(),
                    status: "failed",
                    verdict: None,
                    findings: 0,
                    reason: Some(reason),
                });
            }
        }
    }

    fn to_markdown(&self) -> String {
        let mut text = "## Units\n\n".to_owned();
        for unit in &self.units {
            let detail = match (&unit.verdict, &unit.reason) {
                (Some(verdict), _) => {
                    let plural = if unit.findings == 1 { "" } else { "s" };
                    format!("{} finding{plural}. {}", unit.findings, verdict.trim_end())
                }
                (None, Some(reason)) => format!("failed: {reason}"),
                (None, None) => unit.status.to_owned(),
            };
            let _ = writeln!(text, "- **{}:** {detail}", unit.name);
        }
        text.push_str("\n## Findings\n");
        if self.findings.is_empty() {
            text.push_str("\nNone.\n");
        }
        for entry in &self.findings {
            entry.finding.write_markdown(&mut text, Some(&entry.unit));
        }
        report::write_list(&mut text, "What works", &self.what_works);
        report::write_list(&mut text, "Not checked", &self.not_checked);
        text
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::profile::REVIEW;

    fn unit(name: &str) -> Unit {
        Unit {
            name: name.into(),
            slug: name.into(),
            scope: "s".into(),
            platform: "p".into(),
            users: "u".into(),
            primary_task: "t".into(),
            code: vec![],
            code_bytes: 0,
            captures: vec![],
        }
    }

    fn finding(id: &str, severity: u8, problem: &str) -> Value {
        json!({
            "id": id, "severity": severity, "title": id, "element": "e", "evidence": "Likely",
            "problem": problem, "principle": "p", "fix": "f",
        })
    }

    fn finished(verdict: &str, findings: Value) -> Outcome {
        let report = json!({
            "verdict": verdict, "findings": findings, "what_works": [], "not_checked": ["R2 only"],
        });
        Outcome::Finished(Report::parse(&report).unwrap())
    }

    #[test]
    fn findings_sort_by_severity_then_plan_order_and_ids_follow() {
        let merged = merge(
            &[unit("a"), unit("b")],
            vec![
                finished(
                    "Fix R2 first, then R1.",
                    json!([finding("R1", 2, "See R2."), finding("R2", 3, "x")]),
                ),
                finished("R1 blocks.", json!([finding("R1", 4, "y")])),
            ],
        );
        let order: Vec<(&str, &str, &str)> = merged
            .findings
            .iter()
            .map(|e| {
                let f = &e.finding;
                (f.id.as_str(), f.problem.as_str(), e.unit.as_str())
            })
            .collect();
        assert_eq!(
            order,
            [("R1", "y", "b"), ("R2", "x", "a"), ("R3", "See R2.", "a")]
        );
        assert_eq!(merged.findings[2].finding.title, "R3");
        assert_eq!(
            merged.units[0].verdict.as_deref(),
            Some("Fix R2 first, then R3.")
        );
        assert_eq!(merged.units[1].verdict.as_deref(), Some("R1 blocks."));
        assert_eq!(merged.not_checked[0], "a: R2 only");
    }

    #[test]
    fn equal_findings_keep_plan_order_then_the_childs_order() {
        let merged = merge(
            &[unit("a"), unit("b")],
            vec![
                finished("v", json!([finding("R7", 2, "1"), finding("R3", 2, "2")])),
                finished("v", json!([finding("R1", 2, "3")])),
            ],
        );
        let problems: Vec<&str> = merged
            .findings
            .iter()
            .map(|e| e.finding.problem.as_str())
            .collect();
        assert_eq!(problems, ["1", "2", "3"]);
    }

    #[test]
    fn a_failed_unit_lands_under_not_checked_with_its_reason() {
        let merged = merge(
            &[unit("a")],
            vec![Outcome::Failed("timed out\nafter 20 min".into())],
        );
        assert_eq!(merged.units[0].status, "failed");
        assert_eq!(merged.units[0].findings, 0);
        assert_eq!(
            merged.not_checked,
            ["a: not reviewed: timed out after 20 min"]
        );
    }

    #[test]
    fn only_whole_ids_are_rewritten() {
        let ids = HashMap::from([
            ("R1".to_owned(), "R2".to_owned()),
            ("R2".to_owned(), "R3".to_owned()),
        ]);
        assert_eq!(
            rewrite_ids("R1, R2 (R12) PR1 R1x R1.", &ids),
            "R2, R3 (R12) PR1 R1x R2."
        );
        assert_eq!(rewrite_ids("", &ids), "");
    }

    #[test]
    fn a_tampered_record_is_a_failure_not_a_merge() {
        let record = json!({ "ok": true, "report": { "verdict": "x" } }).to_string();
        assert!(parse_outcome(&record, &REVIEW).is_err());
        let record = json!({ "ok": true }).to_string();
        assert!(parse_outcome(&record, &REVIEW).is_err());
        assert!(parse_outcome("not json", &REVIEW).is_err());
    }
}
