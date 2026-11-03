# Sources

The citation keys used in [README.md](README.md), [rules.md](rules.md) and the `theme` and
`theme-review` skills. Checked in November 2026. The m3.material.io pages render their
text with script and couldn't be read directly, so Material is cited from Google's own
token files and the Android developer docs, which carry the same values.

## Token format and structure

| Key | Source |
| --- | --- |
| DTCG-FORMAT | W3C Design Tokens Community Group, *Design Tokens Format Module 2025.10* (stable). `.tokens.json`; `$value`, `$type`, `$description`, `$deprecated`, `$extensions`; `{group.token}` aliases; composite types (typography, shadow, border). https://www.designtokens.org/tr/2025.10/format/ |
| DTCG-RESOLVER | W3C Design Tokens Community Group, *Design Tokens Resolver Module 2025.10* (stable). Token sets and modifiers for contexts such as light and dark mode. https://www.designtokens.org/tr/2025.10/resolver/ |
| M3-TOKENS | Google, *material-web: Theming*. "Reference tokens hold concrete values", "system tokens define decisions and roles", and each component token maps to a system token. https://github.com/material-components/material-web/blob/main/docs/theming/README.md |
| EIGHTSHAPES-TOKENS | Nathan Curtis, *Tokens in Design Systems: 10 Tips* (2016). Options become decisions once applied to a context; build from options to decisions. https://nathanacurtis.substack.com/p/tokens-in-design-systems-25dd82d58421 |
| EIGHTSHAPES-NAMING | Nathan Curtis, *Naming Tokens in Design Systems* (2020). Name by category, concept, property and modifier; generic (primitive) tokens are aliased to purposeful uses; keep a component decision local and promote it only when it's reused. https://nathanacurtis.substack.com/p/naming-tokens-in-design-systems-9e86c7444676 |
| STYLE-DICT | Style Dictionary. Exports one token set to CSS, SCSS, iOS Swift, Android, Compose and Flutter; DTCG-compatible. https://styledictionary.com/reference/hooks/formats/predefined/ |
| ATOMIC | Brad Frost, *Atomic Design*, ch. 2: atoms, molecules, organisms, templates, pages. https://atomicdesign.bradfrost.com/chapter-2/ |

## Consistency and reuse

| Key | Source |
| --- | --- |
| NNG-H4 | Jakob Nielsen, *10 Usability Heuristics*, #4 Consistency and standards: "Users should not have to wonder whether different words, situations, or actions mean the same thing." https://www.nngroup.com/articles/ten-usability-heuristics/ |
| NNG-DS101 | Therese Fessenden, *Design Systems 101* (NN/g). A set of standards to manage design at scale with reusable components and patterns; the benefits are efficiency and consistency. https://www.nngroup.com/articles/design-systems-101/ |
| HIG-COLOR | Apple, *HIG: Color*. "Avoid hard-coding system color values"; don't redefine the meaning of semantic colours; give custom colours light, dark and increased-contrast variants. https://developer.apple.com/design/human-interface-guidelines/color |
| ANDROID-DARK | Android Developers, *Dark theme*. Avoid hard-coded colours, use theme attributes. https://developer.android.com/develop/ui/views/theming/darktheme |
| PRIMER-LINT | GitHub, *primer/stylelint-config*. Lint rules that require colour, spacing, typography, border and shadow variables instead of raw values. https://github.com/primer/stylelint-config |

## Colour

| Key | Source |
| --- | --- |
| M3-COLOR-ROLES | Google, *material-web: Color*. Every role has an `on-` role "for content color with accessible contrast"; primary, primary-container, surface, surface containers. https://github.com/material-components/material-web/blob/main/docs/theming/color.md |
| M3-COMPOSE | Android Developers, *Material Design 3 in Compose*. Five key colours, each a tonal palette of 13 tones; dynamic colour; on-primary on primary; type roles display / headline / title / body / label, body large 16/24; tonal elevation with shadows. https://developer.android.com/develop/ui/compose/designsystems/material3 |
| M3-HCT | Google, *material-color-utilities*. HCT colour space (hue, chroma, tone); a tonal palette varies only in tone. https://github.com/material-foundation/material-color-utilities |
| HIG-DARK | Apple, *HIG: Dark Mode*. Base backgrounds are dimmer and elevated ones brighter; contrast at least 4.5:1, aim for 7:1 for small text; avoid hard-coded colours. https://developer.apple.com/design/human-interface-guidelines/dark-mode |
| WCAG-1.4.1 | W3C, WCAG 2.2 SC 1.4.1 Use of Color (A). https://www.w3.org/TR/WCAG22/#use-of-color |
| WCAG-1.4.3 | W3C, WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA): 4.5:1, 3:1 for large text (18 pt, or 14 pt bold). https://www.w3.org/TR/WCAG22/#contrast-minimum |
| WCAG-1.4.11 | W3C, WCAG 2.2 SC 1.4.11 Non-text Contrast (AA): 3:1 against adjacent colours. https://www.w3.org/TR/WCAG22/#non-text-contrast |

## Space, type, shape, elevation, motion, focus

| Key | Source |
| --- | --- |
| GRID-8PT | spec.fm, *The 8-Point Grid*. Multiples of 8 for dimensions, padding and margin, with a 4 pt baseline grid for type; fewer decisions, more consistency. https://spec.fm/specifics/8-pt-grid |
| MODULAR-SCALE | Tim Brown, *More Meaningful Typography*, A List Apart (2011). A modular scale is a sequence of sizes related by one ratio. https://alistapart.com/article/more-meaningful-typography/ |
| HIG-TYPE | Apple, *HIG: Typography*. iOS body 17 pt with 22 pt leading at the default size; minimum 11 pt. https://developer.apple.com/design/human-interface-guidelines/typography |
| WCAG-1.4.8 | W3C, *Understanding SC 1.4.8 Visual Presentation* (AAA). Line spacing at least 1.5 within paragraphs; lines at most 80 characters. https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html |
| WCAG-1.4.12 | W3C, *Understanding SC 1.4.12 Text Spacing* (AA). Nothing is lost when people set line height 1.5×, paragraph spacing 2×, letter spacing 0.12× and word spacing 0.16×. https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html |
| M3-SHAPE | Google, material-web `_md-sys-shape.scss`. Corner scale none 0, extra-small 4, small 8, medium 12, large 16, extra-large 28, full. https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-shape.scss |
| M3-ELEVATION | Google, material-web `_md-sys-elevation.scss`. Six levels, 0 to 5 (0, 1, 3, 6, 8, 12 dp). https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-elevation.scss |
| M3-MOTION | Google, material-web `_md-sys-motion.scss`. Duration tokens short (50–200 ms) to extra-long (700–1000 ms); standard and emphasized easing curves. https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-motion.scss |
| HIG-MOTION | Apple, *HIG: Motion*. Make motion optional; never the only way to convey information; don't add motion for its own sake. https://developer.apple.com/design/human-interface-guidelines/motion |
| HIG-A11Y | Apple, *HIG: Accessibility*. With Reduce Motion on, cut zooming, scaling and peripheral motion; prefer fades. https://developer.apple.com/design/human-interface-guidelines/accessibility |
| WCAG-2.3.3 | W3C, WCAG 2.2 SC 2.3.3 Animation from Interactions (AAA). https://www.w3.org/TR/WCAG22/#animation-from-interactions |
| WCAG-2.4.7 | W3C, WCAG 2.2 SC 2.4.7 Focus Visible (AA). https://www.w3.org/TR/WCAG22/#focus-visible |
| WCAG-2.4.13 | W3C, WCAG 2.2 SC 2.4.13 Focus Appearance (AAA): at least a 2 CSS px perimeter, 3:1 between focused and unfocused. https://www.w3.org/TR/WCAG22/#focus-appearance |

## Character

| Key | Source |
| --- | --- |
| NNG-AESTHETIC | Kate Moran, *The Aesthetic-Usability Effect* (NN/g, 2024). People perceive attractive products as more usable (Kurosu & Kashimura 1995); attractiveness forgives minor problems, not major ones. https://www.nngroup.com/articles/aesthetic-usability-effect/ |
