# Explore: divergent concepts side by side

Before the deep pipeline, when the request is open, build 2–3 concepts that make
different structural bets. Show them side by side and let the owner pick or mix. Only
then put the chosen direction through every preset, the checks and the independent
review.

**Why.** In Dow et al. (2010), designers who made several prototypes in parallel and got
feedback on all of them produced better results and more varied designs than designers
who iterated on one. They also felt more confident. Nielsen (2011) recommends parallel
design for the same reason: make several rough alternatives at once, then merge the best
ideas from each, rather than polishing the first idea that came to mind. Sources:
[sources](#sources).

## When

- **Explore** when the request leaves the structure open, such as "design the home
  screen for our recipe app" or "a settings area for a team chat app". Also explore
  whenever the owner asks for concepts, options, directions or alternatives.
- **Skip** when the request already fixes the structure: a spec, a wireframe, a named
  layout ("a list with a filter bar and a FAB"), or an existing design to match. Also
  skip for corrections, notes on a published design, and any later round. Say in one
  line that you went straight to the full design and why.
- "N options for <section>" partway through a design is not this stage. See
  [Section options](#section-options).

## How many

Make 2 concepts when only one structural decision is open, and 3 when two or more are.
When the owner names a number, make that many (up to 5). Nielsen suggests at most 5.

## Pick the axes, then the positions

1. List the 2–3 structural decisions that most change this screen. Common ones:
   - **Navigation model:** tabs, a stack from a hub, a sidebar, or search first.
   - **Density:** one item per row with detail, or a dense list or table.
   - **How the main task works:** inline editing, a sheet, a step-by-step flow, or
     direct manipulation.
   - **What the screen leads with:** the user's own content, a recommendation, a
     summary or status, or the next action.
2. Give each concept a **position**: one line that names its choice on each axis, such as
   "Feed first: today's recipes lead; search and saved are tabs; recipes open as a full
   screen." Write the positions so that every pair differs on at least one axis.
3. **Reject styling-only concepts.** If two positions differ only in colour, type,
   radius, imagery or copy, they are one concept. Change an axis or drop one of them.
   The theme is shared, so every concept uses the same theme tokens.

Write the positions to `explore/concepts.json` (format below) before building anything.

## Build each concept separately

Run one subagent per concept, in parallel. Its brief, `explore/<id>/brief.md`, holds
only these three things:

- **The requirements** from step 1, in the owner's words.
- **The theme:** its path or the non-negotiables in
  [shared/theme/rules.md](../theme/rules.md), and the `--head` file.
- **Its own position.**

Never put the other concepts, their positions, or how many concepts there are in a
brief. A designer who knows the alternatives drifts toward them or away from them, and
the concepts stop being independent.

The subagent reads the skill's `references/principles.md` and the screen contract in
[shared/canvas/README.md](../canvas/README.md). Then it writes
`explore/<id>/screen.html`. Where the Agent tool isn't available, build the concepts
one after another. Start each from its brief alone, and don't reopen the others' files
while you build it.

**Fidelity:**
- Build the key screen and one transition: the main task's next screen, a sheet, or a
  state change.
- Use one preset, the most common one (the skill's first).
- Use real content.
- The theme's non-negotiables apply: tokens only, contrast, and target sizes.

Skip the preset sweep, the self-check list and the independent review. The owner
reviews the concepts, and that is this stage's one exception to the review gate. If
the owner asks for more screens of a concept, add them at the same fidelity.

## Assemble and present

`concepts.json` lists each concept in display order. Paths are relative to the file:

```json
{
  "concepts": [
    { "id": "feed", "label": "Feed first", "position": "Today's recipes lead; search and saved are tabs", "screen": "feed/screen.html" },
    { "id": "search", "label": "Search first", "position": "One search field leads; recent and saved sit under it", "screen": "search/screen.html" }
  ]
}
```

Build one canvas with every concept in it. Pass `--concepts` in place of `--screen`:

```sh
node "${CLAUDE_PLUGIN_ROOT}/shared/canvas/build.mjs" --presets "${CLAUDE_PLUGIN_ROOT}/skills/<skill>/references/presets.md" \
  --config config.json --concepts explore/concepts.json --title "Recipes: concepts" --out explore/index.html
```

The canvas opens on the compare view. It shows every concept at the same preset, side
by side, or in one scrolling column where a row would be too small to read. The size,
scheme, text size and state stay in sync. Each concept is labelled with its letter,
label and position. Selecting a label, or a letter in the concept bar, shows that
concept on its own; "Compare" goes back to all of them. The viewer's notes record which
concept they were left on. Publish with the `db` capability, as for any round.

Present the link and list each concept with its position. Then ask the owner to pick
one, or to say what to take from each. Read their notes the usual way (step 8 of the
skill); each note's `where` names its concept.

## After the pick

Merge what the owner chose into one screen. Then run the full pipeline on it, from
"Compose the screen" onward: the section map, every preset, the self-check and the
independent review. The first round after explore is a first round, so review it
whole.

## Section options

When the owner asks for "N options for <section>" (say, "3 options for the filter
bar") on a design in progress:

1. Copy the current `screen.html` once per option. In each copy, change only that
   section's markup, styles and behaviour. Everything else stays byte-for-byte the same.
2. Give each option a one-line position, the same as a concept. The options must
   differ in structure, such as chips or a sheet, or inline or behind a button. A
   different colour isn't a different option.
3. Write `concepts.json` with `"section": "<section name>"` and build it with
   `--concepts`. The compare view titles the page "Options for <section>".
4. Build the options yourself, without subagents and without the review. Only the
   section changes, and the rest has already been reviewed.
5. After the owner picks, fold the choice into the screen. Then run the review gate on
   that round, reviewing it by its diff.

To confirm that only the section changed, diff each option against the original:
`diff screen.html options/<id>/screen.html`. Every changed line must belong to the
section.

## Sources

- **Dow et al. 2010:** Steven P. Dow, Alana Glassco, Jonathan Kass, Melissa Schwarz,
  Daniel L. Schwartz and Scott R. Klemmer, "Parallel prototyping leads to better design
  results, more divergence, and increased self-efficacy", *ACM Transactions on
  Computer-Human Interaction* 17(4), article 18, 2010.
  https://doi.org/10.1145/1879831.1879836
- **Nielsen 2011:** Jakob Nielsen, "Parallel & Iterative Design + Competitive Testing =
  High Usability", Nielsen Norman Group, 17 January 2011. It says to make several
  alternatives at once (at least 3 and probably no more than 5), keep them rough, and
  then make one merged design from the best ideas in each.
  https://www.nngroup.com/articles/parallel-and-iterative-design/2011/
