use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{self, Path, PathBuf};

use image::{ImageFormat, ImageReader};
use serde::Deserialize;

use crate::profile::{self, Profile};

pub const CAPTURES_MAX: usize = 16;
pub const CODE_BYTES_MAX: u64 = 64 * 1024;

const VERSION: u32 = 1;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawPlan {
    version: u32,
    profile: Option<String>,
    platform: Option<String>,
    users: Option<String>,
    primary_task: Option<String>,
    lessons: Option<String>,
    units: Vec<RawUnit>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawUnit {
    name: String,
    scope: String,
    platform: Option<String>,
    users: Option<String>,
    primary_task: Option<String>,
    #[serde(default)]
    code: Vec<String>,
    #[serde(default)]
    captures: Vec<RawCapture>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawCapture {
    path: String,
    state: Option<String>,
    theme: Option<String>,
    size: Option<String>,
}

pub struct Plan {
    pub profile: &'static Profile,
    pub lessons: Option<PathBuf>,
    pub units: Vec<Unit>,
}

pub struct Unit {
    pub name: String,
    pub slug: String,
    pub scope: String,
    pub platform: String,
    pub users: String,
    pub primary_task: String,
    pub code: Vec<PathBuf>,
    pub code_bytes: u64,
    pub captures: Vec<Capture>,
}

pub struct Capture {
    pub path: PathBuf,
    pub file_name: String,
    pub state: Option<String>,
    pub theme: Option<String>,
    pub size: Option<String>,
    pub width: u32,
    pub height: u32,
    pub format: ImageFormat,
}

impl Plan {
    /// Every problem in the plan is reported at once, each naming its unit, so a plan is
    /// fixed in one pass. Nothing has started when this fails.
    pub fn load(path: &Path) -> Result<Plan, String> {
        let text = fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
        let raw: RawPlan =
            serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
        let file = path::absolute(path).map_err(|e| format!("{}: {e}", path.display()))?;
        let base = file.parent().unwrap_or(Path::new("/"));

        let mut problems = Vec::new();
        if raw.version != VERSION {
            problems.push(format!("plan version {} is not {VERSION}", raw.version));
        }
        let name = raw.profile.as_deref().unwrap_or(profile::REVIEW.name);
        let found = profile::named(name);
        if found.is_none() {
            problems.push(format!("unknown profile {name:?}"));
        }
        if raw.units.is_empty() {
            problems.push("the plan has no units".to_owned());
        }
        let units: Vec<Unit> = raw
            .units
            .iter()
            .map(|unit| resolve_unit(&raw, unit, base, &mut problems))
            .collect();
        find_clashes(&units, &mut problems);
        let lessons = resolve_lessons(raw.lessons.as_ref(), base, &mut problems);

        match found {
            Some(profile) if problems.is_empty() => Ok(Plan {
                profile,
                lessons,
                units,
            }),
            _ => Err(problems.join("\n")),
        }
    }

    pub fn select(&self, only: &[String]) -> Result<Vec<&Unit>, String> {
        let unknown: Vec<&str> = only
            .iter()
            .filter(|name| !self.units.iter().any(|unit| unit.name == **name))
            .map(String::as_str)
            .collect();
        if !unknown.is_empty() {
            return Err(format!("no unit named {}", unknown.join(", ")));
        }
        Ok(self
            .units
            .iter()
            .filter(|unit| only.is_empty() || only.contains(&unit.name))
            .collect())
    }

    /// The one folder that holds every unit's code, so children differ only in their
    /// staged folder.
    pub fn code_root(&self) -> Option<PathBuf> {
        let mut folders = self.units.iter().flat_map(|unit| &unit.code).map(|path| {
            if path.is_dir() {
                path.as_path()
            } else {
                path.parent().unwrap_or(path)
            }
        });
        let mut root = folders.next()?.to_path_buf();
        for folder in folders {
            while !folder.starts_with(&root) && root.pop() {}
        }
        Some(root)
    }
}

/// The name as a file name: only letters, digits and single dashes, so a unit's name can't
/// reach outside the out folder.
pub fn slug(name: &str) -> String {
    let lowered = name.to_lowercase();
    let words = lowered.split(|c: char| !c.is_alphanumeric());
    words
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn filled(value: Option<&String>) -> Option<&String> {
    value.filter(|text| !text.trim().is_empty())
}

fn resolve_lessons(
    path: Option<&String>,
    base: &Path,
    problems: &mut Vec<String>,
) -> Option<PathBuf> {
    let path = filled(path)?;
    let found = fs::canonicalize(base.join(path)).and_then(|full| {
        if full.is_file() {
            Ok(full)
        } else {
            Err(io::Error::other("not a file"))
        }
    });
    found
        .map_err(|error| problems.push(format!("lessons {path}: {error}")))
        .ok()
}

fn resolve_unit(raw: &RawPlan, unit: &RawUnit, base: &Path, problems: &mut Vec<String>) -> Unit {
    let name = unit.name.trim();
    let label = format!("unit {name:?}");
    let slug = slug(name);
    if slug.is_empty() {
        problems.push(format!("{label}: the name needs a letter or a digit"));
    }
    if unit.scope.trim().is_empty() {
        problems.push(format!("{label}: the scope is empty"));
    }
    let mut setting = |field: &str, own: Option<&String>, run: Option<&String>| {
        let value = filled(own).or(filled(run)).cloned();
        if value.is_none() {
            problems.push(format!("{label}: no {field}, on the unit or the plan"));
        }
        value.unwrap_or_default()
    };
    let platform = setting("platform", unit.platform.as_ref(), raw.platform.as_ref());
    let users = setting("users", unit.users.as_ref(), raw.users.as_ref());
    let primary_task = setting(
        "primary_task",
        unit.primary_task.as_ref(),
        raw.primary_task.as_ref(),
    );

    if unit.code.is_empty() && unit.captures.is_empty() {
        problems.push(format!("{label}: no code and no captures to review"));
    }
    let (code, code_bytes) = resolve_code(&unit.code, base, &label, problems);
    if code_bytes > CODE_BYTES_MAX {
        problems.push(format!(
            "{label}: {code_bytes} bytes of code, over the budget of {CODE_BYTES_MAX}; split it \
             into smaller units"
        ));
    }
    if unit.captures.len() > CAPTURES_MAX {
        problems.push(format!(
            "{label}: {} captures, over the budget of {CAPTURES_MAX}; split it into smaller units",
            unit.captures.len()
        ));
    }
    let captures = unit
        .captures
        .iter()
        .filter_map(|capture| resolve_capture(capture, base, &label, problems))
        .collect::<Vec<_>>();
    let mut names = HashSet::new();
    for capture in &captures {
        if !names.insert(&capture.file_name) {
            problems.push(format!(
                "{label}: two captures are named {}; a report refers to a capture by file name",
                capture.file_name
            ));
        }
    }
    Unit {
        name: name.to_owned(),
        slug,
        scope: unit.scope.trim().to_owned(),
        platform,
        users,
        primary_task,
        code,
        code_bytes,
        captures,
    }
}

fn resolve_code(
    paths: &[String],
    base: &Path,
    label: &str,
    problems: &mut Vec<String>,
) -> (Vec<PathBuf>, u64) {
    let mut code = Vec::new();
    let mut total = 0;
    for path in paths {
        let found = fs::canonicalize(base.join(path)).and_then(|full| {
            let bytes = bytes_under(&full)?;
            Ok((full, bytes))
        });
        match found {
            Ok((full, bytes)) => {
                code.push(full);
                total += bytes;
            }
            Err(error) => problems.push(format!("{label}: code {path}: {error}")),
        }
    }
    (code, total)
}

/// Links aren't followed: one could loop, or count code outside what the plan names.
fn bytes_under(path: &Path) -> io::Result<u64> {
    let meta = fs::symlink_metadata(path)?;
    if !meta.is_dir() {
        return Ok(if meta.is_file() { meta.len() } else { 0 });
    }
    let mut total = 0;
    for entry in fs::read_dir(path)? {
        total += bytes_under(&entry?.path())?;
    }
    Ok(total)
}

fn is_remote(path: &str) -> bool {
    path.contains("://") || path.starts_with("data:")
}

fn resolve_capture(
    capture: &RawCapture,
    base: &Path,
    label: &str,
    problems: &mut Vec<String>,
) -> Option<Capture> {
    let shown = &capture.path;
    if is_remote(shown) {
        problems.push(format!(
            "{label}: capture {shown}: captures come only from local files"
        ));
        return None;
    }
    let path = base.join(shown);
    let image = read_header(&path);
    let (format, width, height) = match image {
        Ok(found) => found,
        Err(error) => {
            problems.push(format!("{label}: capture {shown}: {error}"));
            return None;
        }
    };
    Some(Capture {
        file_name: path.file_name()?.to_string_lossy().into_owned(),
        path,
        state: filled(capture.state.as_ref()).cloned(),
        theme: filled(capture.theme.as_ref()).cloned(),
        size: filled(capture.size.as_ref()).cloned(),
        width,
        height,
        format,
    })
}

fn read_header(path: &Path) -> Result<(ImageFormat, u32, u32), String> {
    if !path.is_file() {
        return Err("no such file".to_owned());
    }
    // Not ImageReader::open: it takes the format from the file's extension, so a text file
    // named .png would pass here.
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let reader = ImageReader::new(io::BufReader::new(file))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let format = reader.format();
    let Some(format @ (ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP)) = format else {
        return Err("not a PNG, JPEG or WebP image".to_owned());
    };
    let (width, height) = reader.into_dimensions().map_err(|e| e.to_string())?;
    Ok((format, width, height))
}

fn find_clashes(units: &[Unit], problems: &mut Vec<String>) {
    let mut seen: HashMap<&str, &str> = HashMap::new();
    for unit in units.iter().filter(|unit| !unit.slug.is_empty()) {
        if let Some(first) = seen.insert(&unit.slug, &unit.name) {
            problems.push(format!(
                "units {first:?} and {:?} would write the same file; rename one",
                unit.name
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_slug_keeps_letters_and_digits_and_nothing_else() {
        assert_eq!(slug("Search — empty state"), "search-empty-state");
        assert_eq!(slug("../../etc/passwd"), "etc-passwd");
        assert_eq!(slug("Übersicht 2"), "übersicht-2");
        assert_eq!(slug("..."), "");
    }

    #[test]
    fn the_code_root_is_the_folder_they_share() {
        let dir = tempfile::tempdir().unwrap();
        let base = fs::canonicalize(dir.path()).unwrap();
        fs::create_dir_all(base.join("src/ui/search")).unwrap();
        fs::create_dir_all(base.join("src/data")).unwrap();
        fs::write(base.join("src/data/store.rs"), "x").unwrap();
        let unit = |paths: &[&str]| Unit {
            name: "u".into(),
            slug: "u".into(),
            scope: "s".into(),
            platform: "p".into(),
            users: "u".into(),
            primary_task: "t".into(),
            code: paths.iter().map(|path| base.join(path)).collect(),
            code_bytes: 0,
            captures: vec![],
        };
        let root = |units| {
            Plan {
                lessons: None,
                profile: &profile::REVIEW,
                units,
            }
            .code_root()
        };
        assert_eq!(root(vec![unit(&[])]), None);
        assert_eq!(
            root(vec![unit(&["src/data/store.rs"])]),
            Some(base.join("src/data"))
        );
        assert_eq!(
            root(vec![unit(&["src/ui/search"]), unit(&["src/data/store.rs"])]),
            Some(base.join("src"))
        );
    }
}
