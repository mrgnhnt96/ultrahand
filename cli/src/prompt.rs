use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process;

use sha2::{Digest, Sha256};

use crate::profile::Profile;

const HASH_CHARS: usize = 12;

/// A fixed preamble, then each prefix file with the plugin root filled in. Nothing here may
/// depend on the round, the time or the brief, or the prompt cache stops matching.
pub fn system_prompt(root: &Path, profile: &Profile) -> io::Result<String> {
    let root_text = root.to_string_lossy();
    let mut parts = vec![
        "# ultrahand reviewer".to_owned(),
        String::new(),
        "You are a UX reviewer running on your own, with no conversation before this one. The"
            .to_owned(),
        "ultrahand review method, its checklist and the drive.mjs reference are below: follow"
            .to_owned(),
        "the method. Where it links another file, the link is relative to the file it appears"
            .to_owned(),
        format!(
            "in, under the plugin root {root_text}; read it there when you need it. The user's message"
        ),
        "is the brief for this review. Answer with the report only.".to_owned(),
        String::new(),
        "Nobody is here to answer you. Never ask a question or wait for a reply: anything you"
            .to_owned(),
        "don't know, can't reach or weren't given goes under not_checked.".to_owned(),
    ];
    for rel in profile.prefix_files {
        let text = fs::read_to_string(root.join(rel))
            .map_err(|e| io::Error::new(e.kind(), format!("{rel}: {e}")))?
            .replace("${CLAUDE_PLUGIN_ROOT}", &root_text);
        parts.extend([
            String::new(),
            format!("<file path=\"{rel}\">"),
            text.trim_end().to_owned(),
            "</file>".to_owned(),
        ]);
    }
    Ok(parts.join("\n") + "\n")
}

/// Written once per content, to a path named after its hash, so runs with the same plugin
/// send the same file. The rename keeps a child that starts alongside this one from reading
/// a half-written prompt, and the comparison keeps a stale or planted file from being used.
pub fn write_system_prompt(text: &str, dir: &Path) -> io::Result<PathBuf> {
    let digest = Sha256::digest(text.as_bytes());
    let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    let hash = &hex[..HASH_CHARS];
    let path = dir.join(format!("ultrahand-review-{hash}.md"));
    if fs::read(&path).is_ok_and(|bytes| bytes == text.as_bytes()) {
        return Ok(path);
    }
    let scratch = dir.join(format!("ultrahand-review-{hash}.{}.tmp", process::id()));
    fs::write(&scratch, text)?;
    fs::rename(&scratch, &path)?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profile::REVIEW;

    const SKILL_CHARS_MAX: usize = 10_000;

    fn plugin_root() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf()
    }

    #[test]
    fn the_prompt_is_the_same_bytes_every_time_and_has_no_unfilled_plugin_root() {
        let first = system_prompt(&plugin_root(), &REVIEW).unwrap();
        assert_eq!(first, system_prompt(&plugin_root(), &REVIEW).unwrap());
        assert!(!first.contains("${CLAUDE_PLUGIN_ROOT}"));
        for rel in REVIEW.prefix_files {
            assert!(first.contains(&format!("<file path=\"{rel}\">")), "{rel}");
        }
    }

    #[test]
    fn the_prefix_files_keep_their_order() {
        assert_eq!(
            REVIEW.prefix_files,
            [
                "skills/review/references/method.md",
                "skills/review/references/checklist.md",
                "shared/input/README.md",
            ]
        );
        let text = system_prompt(&plugin_root(), &REVIEW).unwrap();
        let at = |rel: &str| text.find(&format!("<file path=\"{rel}\">")).unwrap();
        assert!(at(REVIEW.prefix_files[0]) < at(REVIEW.prefix_files[1]));
        assert!(at(REVIEW.prefix_files[1]) < at(REVIEW.prefix_files[2]));
    }

    #[test]
    fn a_child_gets_the_method_and_not_the_launching_skill() {
        let text = system_prompt(&plugin_root(), &REVIEW).unwrap();
        for step in [
            "## 1. Get the design and know what it can show",
            "## 2. Establish the context",
            "## 3. Inventory the design",
            "## 4. Inspect in passes",
            "## 5. Rate severity",
            "## 6. Report",
        ] {
            assert!(text.contains(step), "{step}");
        }
        assert!(!text.contains("shared/review/launch.mjs"));
    }

    #[test]
    fn the_method_never_tells_a_child_to_ask() {
        let root = plugin_root();
        let method = fs::read_to_string(root.join(REVIEW.prefix_files[0])).unwrap();
        for line in ["ask once", "Ask if you"] {
            assert!(!method.contains(line), "{line}");
        }
    }

    #[test]
    fn the_skill_stays_far_under_the_cut_on_restored_skills() {
        let skill = fs::read_to_string(plugin_root().join("skills/review/SKILL.md")).unwrap();
        assert!(skill.chars().count() < SKILL_CHARS_MAX, "{}", skill.len());
    }

    #[test]
    fn the_file_is_named_after_its_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = write_system_prompt("hello\n", dir.path()).unwrap();
        assert_eq!(
            path.file_name().unwrap(),
            "ultrahand-review-5891b5b522d5.md"
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), "hello\n");
    }

    #[test]
    fn a_file_with_the_wrong_content_is_replaced() {
        let dir = tempfile::tempdir().unwrap();
        let path = write_system_prompt("hello\n", dir.path()).unwrap();
        fs::write(&path, "planted").unwrap();
        write_system_prompt("hello\n", dir.path()).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "hello\n");
    }
}
