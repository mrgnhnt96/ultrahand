use serde_json::Value;

use crate::report::Report;

/// What one kind of review reads and returns. A plan names its profile, and everything else
/// in a run is the same for all of them.
pub struct Profile {
    pub name: &'static str,
    /// The cached prefix, in order. Adding or reordering one changes every review's prefix
    /// once, so keep the list stable.
    pub prefix_files: &'static [&'static str],
    pub schema: &'static str,
    pub parse: fn(&Value) -> Result<Report, String>,
}

pub const REVIEW: Profile = Profile {
    name: "review",
    prefix_files: &[
        "skills/review/SKILL.md",
        "skills/review/references/checklist.md",
        "shared/input/README.md",
    ],
    schema: include_str!("findings.schema.json"),
    parse: Report::parse,
};

pub fn named(name: &str) -> Option<&'static Profile> {
    (name == REVIEW.name).then_some(&REVIEW)
}
