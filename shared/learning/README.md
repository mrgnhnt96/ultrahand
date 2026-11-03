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
lesson whose **Applies to** names this skill or `all`, unless it's marked superseded.

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
   Then it isn't lost if nobody files it.

Until the plugin is fixed, record the project-side workaround as a lesson too.
