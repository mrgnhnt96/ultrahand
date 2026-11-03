# Learning loop

Every ultrahand skill learns in two places:

- **Project lessons** (`design/LESSONS.md`): what this project's owner has taught the
  skills, such as preferences, conventions and decisions they rejected. Every skill reads
  it before starting and adds to it when the owner corrects it, so a correction is made
  once and not again on each run.
- **Plugin feedback:** a correction that shows a skill itself is wrong, such as an
  outdated rule, a missing check, a script bug or a skill that didn't trigger. These go
  back to the plugin, so it improves for every project.

The eval suite (`evals/`, see its README) guards the other direction: a change to a skill
can't quietly make its output worse.

## Read lessons first

Before the skill's first step, look for `design/LESSONS.md` in the project, or in the
artifact's `design/` files for a design that exists only as an artifact. Apply every
lesson whose **Applies to** names this skill or `all`, unless it's marked superseded. Don't
read `LESSONS.archive.md` unless the owner asks about an old lesson.

- A lesson overrides a skill's defaults and creative choices.
- A lesson never silently breaks a non-negotiable (theme rules NN-n, WCAG 2.2 AA, minimum
  target sizes). If one conflicts with them, follow the rule, tell the owner about the
  conflict and its cost, and let them decide. Record their decision as a new lesson.
- For reviews: don't report a finding that a lesson has recorded as intended. List it
  under *Not checked* or *Accepted by the owner* with the lesson ID.

## Record a lesson

Record one when the owner:

- corrects or rejects something the skill produced ("no, buttons here are never
  full-width");
- states a lasting preference ("we always", "we never", "in this app…");
- dismisses a review finding as intended.

Don't record one-off changes to a single screen ("make this title bigger"), anything the
theme already holds, or anything the skill's own rules already say. Theme values (a
colour, a size, a locked decision) belong in `design/THEME.md` through the `theme` skill,
not here. Append an entry with the next ID:

```markdown
## L4 · dialogs · 2026-11-03
- **Rule:** Confirmation dialogs right-align compact buttons, never full-width ones.
- **Why:** Full-width buttons make the desktop app look like the phone app.
- **Applies to:** desktop, review
- **From:** the owner's correction on the Helpdesk delete dialog
```

Keep the rule imperative and testable, give the reason in the owner's terms, and name the
skills it applies to (`mobile`, `tablet`, `desktop`, `review`, `theme`, `theme-review` or
`all`). When a new lesson replaces an old one, keep the old one and add
`- **Superseded by:** L7` to it, so the history stays readable. Create the file when it's
missing, with this header:

```markdown
# Design lessons

What this project's owner has taught the ultrahand skills. Every skill reads this before
it starts. Format: ultrahand `shared/learning/README.md`.
```

Tell the owner in one line what you recorded (`Saved L4: …`), so they can change or remove
it.

## Report a plugin gap

A correction is about the plugin, not the project, when it would apply to any project,
for example:

- a rule or threshold that's wrong, outdated, or wrong for one platform (like a body-size
  rule that ignored dense desktop tools);
- a check that's missing, or one that keeps reporting false positives;
- a script that crashes or gives a wrong answer (`check.mjs`, `scan.mjs`, `build.mjs`,
  `drive.mjs`, `audit.mjs`);
- a skill that didn't trigger when it should have, or triggered when it shouldn't.

Write a short report: what happened, the skill and file (`skills/desktop/SKILL.md` step 6,
`shared/theme/check.mjs`), the evidence (input, output, the owner's words), and a proposed
fix with a cited source when it changes a design rule. Then deliver it:

1. If the user's own instructions name a tracker for ultrahand work, file it there.
2. Otherwise, offer to open an issue at https://github.com/mrgnhnt96/ultrahand/issues.
   Show the text first: an issue is public, so open it only when the user agrees, and
   leave out project names, code and anything private.
3. Always, filed or not, add a line under `## Plugin feedback` at the end of
   `design/LESSONS.md`, creating the file with the header above when it's missing:
   `- 2026-11-03 · desktop step 6 · body-size rule too strict for dense tools · filed #18`.
   Then it isn't lost if nobody files it. The last field is its status: `open`,
   `filed #n`, `fixed in v0.4.0` or `declined`. Update it when you learn it changed.

Until the plugin is fixed, record the project-side workaround as a lesson too.

## Compact the records

Every skill reads LESSONS.md on every run, and THEME.md's changelog only grows, so both
get compacted when they're due. Compaction makes them shorter without losing anything:
what leaves the live file goes to an archive next to it, which skills read only when
asked about history.

**When.** Run `node "${CLAUDE_PLUGIN_ROOT}/shared/learning/size.mjs" design` after
adding a lesson or a changelog line, and when the owner asks to tidy or compact the
records. It prints `compact: yes` with reasons past any of these limits:

| Record | Limit |
| --- | --- |
| Active lessons | more than 25 |
| Superseded lessons still in LESSONS.md | 5 or more |
| Plugin-feedback lines that are `fixed` or `declined` | 5 or more |
| LESSONS.md | more than 250 lines |
| THEME.md changelog | more than 12 entries |

When it's due, finish the current task first, then propose the compaction. Don't do it
in the middle of a design.

**LESSONS.md.** Work through it in this order:

1. **Archive** each superseded lesson, and each plugin-feedback line that's fixed or
   declined, by moving it whole to `design/LESSONS.archive.md`. Append it there under a
   `## Archived <date>` heading. Before archiving a lesson as fixed, check that the plugin
   now does what it asked.
2. **Promote** lessons that belong in a stronger record. A lesson that fixes a theme
   value ("body text is 14px here") becomes a locked decision in THEME.md through the
   `theme` skill. Archive the lesson with `→ THEME.md: <decision>`.
3. **Merge** lessons that state parts of one rule (L3 "right-align dialog buttons", L9
   "dialog buttons are compact") into one new lesson. Give it the next ID and the line
   `- **Merges:** L3, L9`, combine their **Applies to**, and archive the originals. Merge
   only when the rule doesn't change. Two lessons that pull different ways are a
   conflict: ask the owner.
4. **Tighten** wording only. Never weaken, drop or reinterpret a rule. IDs are never
   reused, so a lesson's ID still finds it in the archive.
5. **Order** the active lessons by area (dialogs, copy, navigation…) so related rules sit
   together.

**THEME.md.** The decisions table and component inventory are the current state, so
they're kept whole. Only remove a component once its tokens are removed. The changelog
keeps its 10 newest entries. Move the older ones to `design/THEME.changelog.md`, newest
first, and end the changelog with `- Older versions: THEME.changelog.md`. A locked
decision's reason belongs in the decisions table, so it survives this.

**Ask first.** Compaction rewrites what the owner taught, so show it before writing: a
table of each lesson kept, merged (into which), promoted (to where) or archived (why),
and the size before and after (from `size.mjs`). Write it when the owner agrees, then
run `size.mjs` again and report the new size.
