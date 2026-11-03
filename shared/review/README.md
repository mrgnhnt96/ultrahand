# Review every round

Every design round ends with an independent review, and the user hears the design is ready
only after it. A **round** is the first design and every later prompt that changes it, so a
one-line tweak gets reviewed too. Skip the review only when the user says to skip it in
this round, and say in the presentation that you skipped it.

A designer checking its own work tends to see what it meant to build, not what it built,
and any one reviewer misses problems that another catches (`NNG-HE` in
[the review skill's sources](../../skills/review/references/sources.md)). So the review
goes to a fresh agent that has seen only the design, never to the designer.

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

Build `index.html` and review that local file **before you publish**. Start a new agent
with the Agent tool. Use a general-purpose agent, not a fork: a fork shares your context
and inherits your blind spots. Give it only what it needs, and none of your own
self-check conclusions:

```text
Review a UI design with the ultrahand:review skill (load it with the Skill tool first and
follow it). Don't edit any files.

Design: <absolute path to index.html>, an ultrahand canvas build. Drive it with
<plugin root>/shared/input/drive.mjs.
Platform and sizes: <platform>, presets <ids>, limits <min/max>.
This round's request, in the user's words: "<prompt>"
Scope: <"the whole design" | "the changes in <absolute path to round-n.diff> and every
screen, state, size and scheme they touch">.
Still open from the last round: <findings you reported but didn't fix, or "none">.

Return the review skill's report: verdict, findings with ID, severity, element, evidence,
problem, principle and fix, then what you couldn't check. Name any problem outside the
scope that you happened to see, but don't go looking for one.
```

If you can't start an agent, run the review skill yourself as a separate pass after the
self-check, and say in the presentation that the review wasn't independent.

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
fixed, and anything left open with the reason.
