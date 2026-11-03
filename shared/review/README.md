# Review every round

Every design round ends with an independent review, and the user hears the design is ready
only after it. A **round** is the first design and every later prompt that changes it, so a
one-line tweak gets reviewed too. Skip the review only when the user says to skip it in
this round, and say in the presentation that you skipped it.

A designer checking its own work tends to see what it meant to build, not what it built,
and any one reviewer misses problems that another catches (`NNG-HE` in
[the review skill's sources](../../skills/review/references/sources.md)). So the review
goes to a reviewer in its own session that has seen only the brief and the design, never
to the designer.

## 1. Keep each round on disk

Work in one build folder for the whole design. After presenting a round, copy its inputs
into `rounds/<n>/` (`screen.html`, `config.json`, and `theme.html` if there is one):

```sh
mkdir -p rounds/1 && cp screen.html config.json rounds/1/
```

Before the next round's review, diff the inputs against the last presented round:

```sh
diff -u rounds/1/screen.html screen.html > round-2.diff
diff -u rounds/1/config.json config.json >> round-2.diff
```

If the last round isn't on disk (a new session continues an earlier design), save the live
artifact's HTML as the baseline before you edit, and diff the new `index.html` against it.

## 2. Choose the scope

- **First round:** the whole design.
- **Later rounds:** the diff, and everything it touches: each screen, state, size and
  scheme where a changed element shows, and the sections around it, so the reviewer can
  judge whether the round made the screen busier.
- **Widen to the whole design** when the diff changes something shared: the navigation or
  layout shell, the breakpoints or container queries, shared CSS or theme tokens, or the
  config's presets and limits. Widen too when the diff rewrites most of `screen.html`.

## 3. Hand it to a fresh reviewer

Build `index.html` and review that local file **before you publish**. The reviewer runs
as its own headless Claude session, which has never seen this conversation, so it can't
share your blind spots. Write the brief (below), then run:

```sh
node "${CLAUDE_PLUGIN_ROOT}/shared/review/run.mjs" --brief rounds/<n>/brief-<k>.md \
  --add-dir <project root>
```

It writes the report to `rounds/<n>/review-<k>.md` and what the review cost to
`review-<k>.json`, and prints a one-line summary. Pass `--add-dir` for each folder the
brief points at outside the build folder, such as the project's `design/`. A review takes
a few minutes, so run it in the background and wait for it to finish.

The runner starts the reviewer lean (none of the user's settings, plugins or MCP servers,
and only Read, Glob, Grep and Bash) and on the 5-minute prompt cache. Its system prompt
is the review skill, the checklist and the drive.mjs reference, the same on every run, so
a review that starts within five minutes of the last one reads them from the cache. Use
`--model` and `--effort` only when the user asks for them; the default is Opus.

If the runner can't start (no `claude` on the PATH, or it fails before the review
begins), start a general-purpose agent with the Agent tool instead, not a fork: a fork
shares your context. Send it the same brief with this line first: "Load the
ultrahand:review skill with the Skill tool, then follow it."

### The brief carries facts, never your view

The reviewer's independence lives in the brief. Whatever you put there, it reads as
true, so a brief that explains or defends the design turns the review into a check of
your claims. Fill in the template below and add nothing else. Each field takes only
what its line says:

- **The request** is the user's words, quoted. Don't summarise or restate it.
- **Screens** names what's on the canvas and which parts are review chrome, as plain
  labels. Don't describe what a screen is meant to achieve.
- **Project records** are paths. Don't paraphrase the owner's preferences: the reviewer
  reads `design/LESSONS.md` and `THEME.md` itself.
- **Scope** is "the whole design" or a diff path. Don't say what the diff does.
- **Still open** is finding IDs and titles copied from the last review's report, and
  for each one you chose not to fix, the user's words that made you keep it.

Never write into a brief:

- Why you made a choice, or that you made one on purpose ("deliberately", "so that",
  "to keep").
- What you changed or fixed, in your words. The diff shows what changed.
- What to look at "in particular", or what you expect the reviewer to find.
- Your self-check results, which concept you prefer, or how severe you think a problem
  is.

Write the brief to `rounds/<n>/brief-<k>.md` (`k` counts the reviews in that round). The
runner saves the report beside it as `rounds/<n>/review-<k>.md`, so the next brief can
point at it. If you used the Agent tool, save the report there yourself.

### Template

```text
Review a UI design with the ultrahand review skill. Don't edit any files.

Design: <absolute path to index.html>, an ultrahand canvas build. Drive it with
<plugin root>/shared/input/drive.mjs. Put screenshots under <absolute path to
rounds/<n>/shots/>.
Platform and sizes: <platform>, presets <ids>, limits <min/max>.
Screens: <screen labels; which controls are review chrome, not part of the app>.
Project records: <absolute paths to design/LESSONS.md and THEME.md, or "none">.
This round's request, in the user's words: "<prompt>"
Scope: <"the whole design" | "the changes in <absolute path to round-n.diff> and every
screen, state, size and scheme they touch">.
Still open from the last round: <IDs and titles from the last report, each with the
user's words if you kept it on purpose, or "none">.

Return the review skill's report: verdict, findings with ID, severity, element, evidence,
problem, principle and fix, then what you couldn't check. Name any problem outside the
scope that you happened to see, but don't go looking for one.
```

### Checking fixes

When you send fixes back (step 4), the brief is the same template with this scope, and
nothing that describes the fixes:

```text
Scope: check whether findings <IDs> in <absolute path to rounds/<n>/review-<k>.md> are
resolved, using the changes in <absolute path to the fix diff>, and every screen, state,
size and scheme those changes touch.
```

The reviewer reads the findings in the last reviewer's words and the fix in the diff,
so it judges the fix, not your account of it.

If neither the runner nor an agent can start, run the review skill yourself as a separate
pass after the self-check, and say in the presentation that the review wasn't
independent.

## 4. Act on the findings

- Fix every 4 and 3, and every WCAG failure.
- Fix the 2s, unless a fix would undo what the user asked for this round: then report it.
- Fix 1s when it's quick.
- If you fixed anything rated 3 or 4, send just those fixes back to a fresh reviewer, with
  the fix diff as the scope. Stop after two review passes, and report what's left.

Then publish, save the round to `rounds/<n>/`, and present.

## 5. Report the review

In the presentation, add a short **Review** note: the scope and why (this round's changes,
or the whole design because something shared changed), the findings by severity, what you
fixed, anything left open with the reason, and what the reviews cost (from each
`review-<k>.json`).
