# Theme rules

A theme has three kinds of decision. Keep them apart: mixing them up is how a theme
becomes either the same look every time or a different look every screen.

| Kind | Who decides | Where it's written | Can it change? |
| --- | --- | --- | --- |
| **Non-negotiables** (NN) | This plugin, from the research | Here | No. Every theme, every project. |
| **Project decisions** | The project owner, once | `THEME.md`, marked `locked` or `open` | Locked ones only when the owner asks (major version); open ones as the theme matures. |
| **Creative axes** (CR) | Chosen fresh for each project | `THEME.md` personality | Per project, inside the non-negotiables. |

Non-negotiables are what make an interface feel well made, whatever it looks like: an
even rhythm, readable text, clear roles, both schemes. Creative axes are what make one
product look like itself and not like the last one. People judge attractive interfaces as
easier to use and forgive them small problems [NNG-AESTHETIC], so character is not
decoration. But it never buys an exception to a non-negotiable.

`check.mjs` tests every NN rule it can measure; the rest are checked by the skills.

## Non-negotiables

- **NN-1 Three tiers, and designs use roles.** Primitives hold raw values, semantic tokens
  alias primitives, and component tokens alias semantic tokens [M3-TOKENS]
  [EIGHTSHAPES-TOKENS]. Screens and code use semantic and component tokens, never a
  primitive and never a raw value (hex, px) [HIG-COLOR] [ANDROID-DARK] [PRIMER-LINT].
- **NN-2 Spacing on the 8-point grid.** Every spacing step is a multiple of 8, with 4 and 12
  allowed below 16 for tight gaps inside a component and to fit the 4-point type baseline
  [GRID-8PT]. The scale: 0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96. No other values, no
  one-offs ("13px to make it line up" means something else is off the grid). The 4 and 12
  half-steps are this plugin's working rule, not the source's.
- **NN-3 Both schemes.** Every semantic colour has a light and a dark value, designed, not
  inverted. In dark mode, raised surfaces are lighter than the base, not just shadowed
  [HIG-DARK] [M3-COMPOSE].
- **NN-4 Contrast, measured in both schemes.** Text on its background at least 4.5:1, large
  text and UI parts (outlines, icons, the primary colour against the surface) at least 3:1
  [WCAG-1.4.3] [WCAG-1.4.11]. Every `on-X` role is designed against `X` [M3-COLOR-ROLES].
  Aim for 7:1 for small text where the palette allows [HIG-DARK].
- **NN-5 The required roles exist.** `surface`, `on-surface`, `on-surface-variant`,
  `primary`, `on-primary`, `outline`, `error`, `on-error`, `focus-ring`, and a `body` type
  style (README.md lists them). Status (error, and warning or success if used) never relies
  on hue alone: pair it with an icon or text [WCAG-1.4.1].
- **NN-6 A real type scale.** Sizes come from one scale built on a ratio [MODULAR-SCALE],
  about 6 to 10 sizes in all, named by role (display, headline, title, body, label)
  [M3-COMPOSE]. Body text at least 16 px (17 pt on iOS) [M3-COMPOSE] [HIG-TYPE]; body line
  height at least 1.3, and 1.5 for long reading [WCAG-1.4.8]. Sizes in `rem` on the web so
  text scales, and layouts survive text-spacing overrides [WCAG-1.4.12].
- **NN-7 A short radius scale.** About five steps plus `full`, on the 4 grid [M3-SHAPE].
  Every component of one role uses the same radius; nested corners shrink inward (inner
  radius = outer radius minus the padding), never grow.
- **NN-8 Few elevation levels.** At most six, from flat to the highest overlay
  [M3-ELEVATION]. Each level means one thing (resting card, menu, dialog); the same kind of
  surface always sits at the same level.
- **NN-9 Motion is tokenised and optional.** Durations and easings come from tokens
  [M3-MOTION]. Motion never carries meaning alone, and with Reduce Motion on, movement
  becomes a fade or nothing [HIG-MOTION] [HIG-A11Y] [WCAG-2.3.3].
- **NN-10 A visible focus ring.** At least 2 px, with 3:1 contrast against what's around it,
  in both schemes [WCAG-2.4.7] [WCAG-2.4.13].
- **NN-11 Names say the role, not the value.** `on-surface-variant`, not `grey-600`;
  `gap-group`, not `space-16`. A rebrand changes primitives and leaves every semantic name
  true [EIGHTSHAPES-NAMING].
- **NN-12 Grow, don't replace.** A theme is extended and refined, never regenerated. A
  retired token is marked `$deprecated` with its replacement for at least one version
  before it goes [DTCG-FORMAT]. See [Evolving a theme](#evolving-a-theme).

## Creative axes

Choose a position on every axis for each project, from its personality (three adjectives
from the owner: who it's for, how it should feel). Any position is allowed; what isn't
allowed is skipping the choice and taking the defaults.

| Axis | Range | Notes |
| --- | --- | --- |
| **CR-1 Hue** | any brand hue, one or two accents | The palette is built from it as tonal steps [M3-HCT], so any hue can meet NN-4. |
| **CR-2 Neutral temperature** | cool grey · true grey · warm grey · tinted toward the brand | The quietest choice with the biggest effect on feel. |
| **CR-3 Colour intensity** | muted · balanced · vivid | How saturated the containers and accents are. |
| **CR-4 Type voice** | one family or a pair; sans · serif · slab · mono · rounded | A display face can carry the personality while body stays plain. |
| **CR-5 Type contrast** | scale ratio 1.125 (calm, dense) to 1.333 (dramatic) | [MODULAR-SCALE] |
| **CR-6 Corners** | sharp (0–2) · crisp (4) · soft (8) · round (12–16) · pill | One personality across controls and containers. |
| **CR-7 Depth** | flat · outlined · tonal · shadowed | How elevation shows. Pick one primary method [M3-COMPOSE]. |
| **CR-8 Density** | compact · comfortable · spacious | Moves along the NN-2 scale, never off it. |
| **CR-9 Motion character** | brisk · smooth · expressive | Which duration and easing tokens components use. |
| **CR-10 Iconography** | outlined · filled · duotone; stroke weight | Matches the type weight. |

**Avoid the default look.** Unless the owner asks for it or an existing brand sets it, don't
land on the generic stack: a mid blue primary, Inter or the system font for everything, an
8 px radius everywhere, a cool grey page and soft drop shadows. It's not wrong, it's
unchosen. When proposing a new theme, offer **three directions** that differ on at least
three axes, each with a one-line rationale, and let the owner pick or mix.

## Evolving a theme

The theme file is the project's memory. Every skill that touches it builds on what's there.

- **EV-1 Read before you write.** Load `THEME.md` and the tokens first. Never generate a new
  theme when one exists, and never overwrite a locked decision without the owner asking.
- **EV-2 Reuse first.** For a new need, use an existing role. Only add a token when no role
  fits, and only promote a value to a semantic token when it's needed in more than one
  place; until then a component token is enough [EIGHTSHAPES-NAMING].
- **EV-3 New tokens alias existing primitives.** Add a primitive only when no step on the
  existing scales fits, and then as a step on that scale (a new tone of the same hue, the
  next grid step), not a free value.
- **EV-4 Components before variants, variants before new components.** Before building a
  component, check the inventory. A near-match becomes a variant of the existing one; a
  second component doing the same job is a finding [NNG-H4] [NNG-DS101].
- **EV-5 Record it.** Every change bumps the version (semver, see README.md), adds a
  changelog line saying what changed and which screens needed it, and updates the
  component inventory.
- **EV-6 Deprecate, then remove.** Rename or retire with `$deprecated` naming the
  replacement; remove it in a later version, once nothing uses it.
- **EV-7 Open decisions converge.** An `open` decision that has been used unchanged across
  several screens can be proposed as `locked`; ask the owner.
