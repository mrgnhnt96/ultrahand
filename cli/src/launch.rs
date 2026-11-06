use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};

/// The same lean launch as mudora's reviewer, copied on purpose: the two commands share no
/// code, so a change to one table has to be made to the other by hand.
const LEAN_ARGS: &[&str] = &[
    "-p",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--output-format",
    "stream-json",
    "--verbose",
];

const TOOLS: &str = "Read,Glob,Grep,Bash";
const READ_TOOLS: &str = "Read,Glob,Grep";
const DENIED: [&str; 2] = ["Bash(* --chrome *)", "Bash(* --chrome=*)"];

/// Windows of 60,000 and below are ignored and 100,000 thrashes; 200,000 keeps compaction
/// above the 120,000 a child plans to reach.
const SETTINGS: &str =
    r#"{"autoMemoryEnabled":false,"includeGitInstructions":false,"autoCompactWindow":200000}"#;

const ALWAYS_KEPT: [&str; 7] = ["HOME", "USER", "LOGNAME", "PATH", "TMPDIR", "LANG", "SHELL"];
const AUTH_KEPT: [&str; 5] = [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "CLAUDE_CONFIG_DIR",
];
const NETWORK_KEPT: [&str; 11] = [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "no_proxy",
    "NODE_EXTRA_CA_CERTS",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
];
const CACHE_TTL: (&str, &str) = ("CLAUDE_CODE_PROMPT_CACHE_TTL", "5m");

pub struct Options<'a> {
    pub system: &'a Path,
    pub schema: &'a str,
    pub model: &'a str,
    pub effort: &'a str,
    pub add_dirs: &'a [PathBuf],
    pub root: &'a Path,
}

fn drive_script(root: &Path) -> String {
    root.join("shared/input/drive.mjs")
        .to_string_lossy()
        .into_owned()
}

/// The shell lock matches the command as written, so the rule and the command a child is
/// told to run come from here. A path with a space only passes quoted, in both places.
pub fn drive_command(root: &Path) -> String {
    let script = drive_script(root);
    if script.contains(char::is_whitespace) {
        format!("node \"{script}\"")
    } else {
        format!("node {script}")
    }
}

pub fn claude_args(options: &Options) -> Vec<OsString> {
    let drive_rule = format!("Bash({}:*)", drive_command(options.root));
    let allowed = format!("{READ_TOOLS},{drive_rule}");
    let mut args: Vec<OsString> = LEAN_ARGS.iter().map(OsString::from).collect();
    let pairs: [(&str, &OsStr); 5] = [
        ("--model", options.model.as_ref()),
        ("--system-prompt-file", options.system.as_os_str()),
        ("--permission-mode", "dontAsk".as_ref()),
        ("--tools", TOOLS.as_ref()),
        ("--allowedTools", allowed.as_ref()),
    ];
    push_pairs(&mut args, &pairs);
    args.push("--disallowedTools".into());
    args.extend(DENIED.iter().map(OsString::from));
    push_pairs(
        &mut args,
        &[
            ("--settings", SETTINGS.as_ref()),
            ("--json-schema", options.schema.as_ref()),
            ("--add-dir", options.root.as_os_str()),
        ],
    );
    if !options.effort.is_empty() {
        push_pairs(&mut args, &[("--effort", options.effort.as_ref())]);
    }
    for dir in options.add_dirs {
        push_pairs(&mut args, &[("--add-dir", dir.as_os_str())]);
    }
    args
}

fn push_pairs(args: &mut Vec<OsString>, pairs: &[(&str, &OsStr)]) {
    for (name, value) in pairs {
        args.push(name.into());
        args.push((*value).to_owned());
    }
}

/// A child starts from an empty environment. Session ids, messaging sockets and compaction
/// overrides all reach it if inherited, so anything not named here is left behind.
pub fn child_env(parent: impl Iterator<Item = (OsString, OsString)>) -> Vec<(OsString, OsString)> {
    let kept = |name: &OsStr| {
        let listed = |list: &[&str]| list.iter().any(|keep| OsStr::new(keep) == name);
        listed(&ALWAYS_KEPT) || listed(&AUTH_KEPT) || listed(&NETWORK_KEPT)
    };
    let mut env: Vec<_> = parent.filter(|(name, _)| kept(name)).collect();
    env.push((CACHE_TTL.0.into(), CACHE_TTL.1.into()));
    env
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(root: &str) -> Vec<String> {
        let options = Options {
            system: Path::new("/s.md"),
            schema: crate::profile::REVIEW.schema,
            model: "sonnet",
            effort: "medium",
            add_dirs: &[PathBuf::from("/p")],
            root: Path::new(root),
        };
        claude_args(&options)
            .iter()
            .map(|a| a.to_str().unwrap().to_owned())
            .collect()
    }

    fn after<'a>(args: &'a [String], name: &str) -> &'a str {
        let at = args.iter().position(|arg| arg == name).unwrap();
        &args[at + 1]
    }

    #[test]
    fn the_reviewer_starts_lean_with_only_review_tools() {
        let args = args("/plugin");
        assert_eq!(after(&args, "--setting-sources"), "");
        assert!(args.iter().any(|arg| arg == "--strict-mcp-config"));
        assert!(args.iter().any(|arg| arg == "--disable-slash-commands"));
        assert!(args.iter().any(|arg| arg == "--no-session-persistence"));
        assert_eq!(after(&args, "--system-prompt-file"), "/s.md");
        assert_eq!(after(&args, "--output-format"), "stream-json");
        assert_eq!(after(&args, "--tools"), "Read,Glob,Grep,Bash");
        assert_eq!(after(&args, "--permission-mode"), "dontAsk");
        assert_eq!(after(&args, "--model"), "sonnet");
        assert_eq!(after(&args, "--effort"), "medium");
        assert!(args.iter().any(|arg| arg == "/p"));
    }

    #[test]
    fn bash_is_locked_to_the_driver_and_nothing_can_write() {
        let args = args("/plugin");
        assert_eq!(
            after(&args, "--allowedTools"),
            "Read,Glob,Grep,Bash(node /plugin/shared/input/drive.mjs:*)"
        );
        let denied = args
            .iter()
            .position(|arg| arg == "--disallowedTools")
            .unwrap();
        assert_eq!(args[denied + 1], "Bash(* --chrome *)");
        assert_eq!(args[denied + 2], "Bash(* --chrome=*)");
        for tool in ["Write", "Edit"] {
            assert!(!after(&args, "--tools").contains(tool));
            assert!(!after(&args, "--allowedTools").contains(tool));
        }
    }

    #[test]
    fn a_plugin_path_with_a_space_gets_the_quoted_rule() {
        let args = args("/my plugin");
        assert_eq!(
            after(&args, "--allowedTools"),
            "Read,Glob,Grep,Bash(node \"/my plugin/shared/input/drive.mjs\":*)"
        );
    }

    #[test]
    fn settings_and_schema_are_valid_json() {
        let args = args("/plugin");
        let settings: serde_json::Value = serde_json::from_str(after(&args, "--settings")).unwrap();
        assert_eq!(settings["autoCompactWindow"], 200_000);
        assert_eq!(settings["autoMemoryEnabled"], false);
        assert_eq!(settings["includeGitInstructions"], false);
        let schema: serde_json::Value =
            serde_json::from_str(after(&args, "--json-schema")).unwrap();
        assert_eq!(schema["additionalProperties"], false);
        assert_eq!(
            schema["properties"]["findings"]["items"]["additionalProperties"],
            false
        );
    }

    #[test]
    fn no_effort_means_no_effort_flag() {
        let options = Options {
            system: Path::new("/s.md"),
            schema: crate::profile::REVIEW.schema,
            model: "opus",
            effort: "",
            add_dirs: &[],
            root: Path::new("/plugin"),
        };
        assert!(!claude_args(&options).iter().any(|arg| arg == "--effort"));
    }

    #[test]
    fn only_the_keep_list_reaches_a_child() {
        let parent = [
            ("HOME", "/h"),
            ("ANTHROPIC_API_KEY", "k"),
            ("https_proxy", "p"),
            ("CLAUDE_CODE_SESSION_ID", "s"),
            ("MIDNA_SESSION", "m"),
            ("CLAUDE_AUTOCOMPACT_PCT_OVERRIDE", "3"),
            ("CLAUDE_CODE_AUTO_COMPACT_WINDOW", "150000"),
            ("UH_SECTIONS", "x"),
        ];
        let env = child_env(parent.iter().map(|(k, v)| (k.into(), v.into())));
        let names: Vec<_> = env.iter().map(|(k, _)| k.to_str().unwrap()).collect();
        assert_eq!(
            names,
            [
                "HOME",
                "ANTHROPIC_API_KEY",
                "https_proxy",
                "CLAUDE_CODE_PROMPT_CACHE_TTL"
            ]
        );
    }
}
