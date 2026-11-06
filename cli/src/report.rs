use std::fmt::Write;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Report {
    verdict: String,
    findings: Vec<Finding>,
    what_works: Vec<String>,
    not_checked: Vec<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Finding {
    id: String,
    severity: u8,
    title: String,
    element: String,
    evidence: Evidence,
    problem: String,
    principle: String,
    fix: String,
}

#[derive(Serialize, Deserialize)]
enum Evidence {
    Confirmed,
    Likely,
}

impl Evidence {
    fn label(&self) -> &'static str {
        match self {
            Evidence::Confirmed => "Confirmed",
            Evidence::Likely => "Likely",
        }
    }
}

fn severity_label(severity: u8) -> &'static str {
    match severity {
        4 => "4 Catastrophe",
        3 => "3 Major",
        2 => "2 Minor",
        _ => "1 Cosmetic",
    }
}

fn valid_id(id: &str) -> bool {
    id.strip_prefix('R')
        .is_some_and(|digits| !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()))
}

impl Report {
    /// The schema is checked here as well as by claude: anything the merge will read later
    /// has to hold, whatever produced it.
    pub fn parse(value: &Value) -> Result<Report, String> {
        let report: Report = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
        for finding in &report.findings {
            if !valid_id(&finding.id) {
                return Err(format!("finding id {:?} is not R<number>", finding.id));
            }
            if !(1..=4).contains(&finding.severity) {
                return Err(format!(
                    "finding {} has severity {}",
                    finding.id, finding.severity
                ));
            }
        }
        Ok(report)
    }

    /// A child's report arrives only as data, so the readable report is written here, in
    /// the review skill's template.
    pub fn to_markdown(&self) -> String {
        let mut text = format!("## Verdict\n\n{}\n\n## Findings\n", self.verdict.trim_end());
        if self.findings.is_empty() {
            text.push_str("\nNone.\n");
        }
        for finding in &self.findings {
            finding.write_markdown(&mut text);
        }
        write_list(&mut text, "What works", &self.what_works);
        write_list(&mut text, "Not checked", &self.not_checked);
        text
    }
}

impl Finding {
    fn write_markdown(&self, text: &mut String) {
        let heading = format!(
            "{} · {} · {}",
            self.id,
            severity_label(self.severity),
            self.title
        );
        let _ = write!(
            text,
            "\n### {heading}\n- **Element:** {}\n- **Evidence:** {}\n- **Problem:** {}\n- **Principle:** {}\n- **Fix:** {}\n",
            self.element,
            self.evidence.label(),
            self.problem,
            self.principle,
            self.fix,
        );
    }
}

fn write_list(text: &mut String, heading: &str, items: &[String]) {
    let _ = write!(text, "\n## {heading}\n\n");
    if items.is_empty() {
        text.push_str("None.\n");
    }
    for item in items {
        let _ = writeln!(text, "- {item}");
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn finding() -> Value {
        json!({
            "id": "R1", "severity": 3, "title": "Low contrast", "element": "Search › hint",
            "evidence": "Confirmed", "problem": "Hard to read", "principle": "WCAG 1.4.3",
            "fix": "Raise to #595959",
        })
    }

    fn report(findings: Value) -> Value {
        json!({
            "verdict": "Ship after R1.", "findings": findings,
            "what_works": ["Clear focus"], "not_checked": [],
        })
    }

    #[test]
    fn a_report_renders_in_the_skills_template() {
        let text = Report::parse(&report(json!([finding()])))
            .unwrap()
            .to_markdown();
        assert_eq!(
            text,
            "## Verdict\n\nShip after R1.\n\n## Findings\n\n\
             ### R1 · 3 Major · Low contrast\n\
             - **Element:** Search › hint\n\
             - **Evidence:** Confirmed\n\
             - **Problem:** Hard to read\n\
             - **Principle:** WCAG 1.4.3\n\
             - **Fix:** Raise to #595959\n\n\
             ## What works\n\n- Clear focus\n\n\
             ## Not checked\n\nNone.\n"
        );
    }

    #[test]
    fn no_findings_says_so() {
        let text = Report::parse(&report(json!([]))).unwrap().to_markdown();
        assert!(text.contains("## Findings\n\nNone.\n"));
    }

    #[test]
    fn extra_keys_are_refused_at_both_levels() {
        let mut top = report(json!([]));
        top["extra"] = json!(1);
        assert!(Report::parse(&top).is_err());
        let mut inner = finding();
        inner["extra"] = json!(1);
        assert!(Report::parse(&report(json!([inner]))).is_err());
    }

    #[test]
    fn missing_keys_are_refused() {
        assert!(Report::parse(&json!({ "verdict": "x" })).is_err());
    }

    #[test]
    fn ids_severities_and_evidence_are_checked() {
        for (key, value) in [
            ("id", json!("X1")),
            ("id", json!("R")),
            ("severity", json!(0)),
            ("severity", json!(5)),
            ("evidence", json!("Maybe")),
        ] {
            let mut bad = finding();
            bad[key] = value.clone();
            assert!(
                Report::parse(&report(json!([bad]))).is_err(),
                "{key} {value}"
            );
        }
    }
}
