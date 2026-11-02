# Mobile design principles

Each rule cites a key from [sources.md](sources.md). Where sources disagree, the stricter
number wins. Units: 1 CSS px ≈ 1 pt (iOS) ≈ 1 dp (Android) at the canvas presets.

## 1. Touch targets

- **Make every tap target at least 44 × 44 pt (iOS) / 48 × 48 dp (Android).** Use 48 when
  one design serves both platforms. Apple's absolute minimum is 28 × 28 pt; treat it as a
  floor for dense secondary UI, not a goal [HIG-A11Y][AND-A11Y].
- **WCAG 2.2 AA (SC 2.5.8) needs at least 24 × 24 CSS px,** or enough spacing that a 24 px
  circle on each target doesn't overlap a neighbour. Inline links in a sentence are exempt.
  Passing WCAG does not make a target comfortable: aim for the platform sizes above
  [WCAG-2.5.8].
- **Physical size matters more than pixels.** NN/g recommends at least 1 cm × 1 cm, based on
  Parhi et al.'s one-handed thumb study. The average fingertip is 1.6–2 cm wide [NNG-TOUCH]
  [PARHI].
- **Make targets bigger near the edges.** Taps are most accurate in the centre of the screen
  (about 7 mm holds 95% of taps) and least accurate in the corners (about 12 mm) [HOOBER-17].
- **Spacing counts as much as size.** Leave about 12 pt around controls with a visible
  border or background, and about 24 pt around borderless ones [HIG-A11Y].
- **The hit area can be bigger than the visible shape.** A 24 px icon can sit in a 48 px hit
  box. Show the hit box in the canvas when you check targets.

## 2. Grip and thumb reach

- **Design for one thumb, but don't count on it.** In Hoober's field study of 780 people
  touching phones, 49% used one hand, 36% cradled the phone in one hand and tapped with the
  other, and 15% used two hands. People switch grips often without noticing [HOOBER-13]
  [HOOBER-17].
- **Put content and primary actions in the middle; put secondary actions on the top and
  bottom edges; put rare actions in the corners or behind menus.** People look and tap mostly
  in the centre of the screen [HOOBER-17].
- **Keep the main action of a screen reachable without a grip change:** in the lower half,
  or as a full-width button pinned above the home indicator. Destructive actions should not
  sit where a resting thumb lands.
- **Don't treat the bottom of the screen as automatically easy.** On large phones the bottom
  corners are hard too, and a bottom sheet doesn't fix reach on its own [NNG-SHEET].

## 3. Navigation

- **Use a bottom tab bar (iOS) or navigation bar (Android) for 3–5 top-level sections.** Give
  every tab a short text label as well as an icon. Keep the bar visible on every top-level
  screen; hide it only under a modal [HIG-TABS][M3-NAVBAR].
- **Tabs navigate; they don't do things.** Put actions such as "New" or "Share" in a toolbar or
  a button, not a tab [HIG-TABS].
- **Don't hide or disable tabs** when a section is empty. Keep the tab and explain the empty
  state inside it [HIG-TABS].
- **Avoid more than five tabs.** Overflow ("More") tabs hide content. With a deep
  structure, use fewer tabs plus in-section navigation [HIG-TABS].
- **Prefer visible navigation over a lone hamburger icon.** In NN/g testing, a site with
  visible combo navigation had 89% navigation use against 44% for a site with a poorly placed
  hamburger [NNG-HAMBURGER]. If you must use a menu icon, make it large, labelled ("Menu") and
  high contrast.
- **Drill down with a navigation stack.** Each pushed screen gets a title and a back control
  in the top-leading corner, using the standard Back and Close controls; edge-swipe back must
  work too [HIG-TOOLBARS]. Keep each tab's stack when people switch tabs [HIG-TABS].
- **Use sheets for short, focused tasks only** [HIG-SHEET][NNG-SHEET]:
  - Use a modal sheet when people must finish or cancel before going on. Use a nonmodal sheet
    when they need to keep working with the content behind it, such as a map.
  - Give every sheet a visible Close or Cancel button. Don't rely on the grabber or a swipe
    alone. Pair Done with Cancel, and never show Cancel, Done and Back together.
  - On iPhone, offer a medium detent for progressive disclosure, with a grabber.
  - Never stack sheets. Close one before opening the next.
  - Support system Back to dismiss. If there are unsaved changes, confirm before a
    swipe-dismiss throws them away.
  - Long or multi-step flows belong in a full-screen modal or a pushed screen, not a sheet.

## 4. Safe areas, notch and home indicator

- **Keep text and controls inside the safe area.** Backgrounds may run edge to edge; content
  may not run under the status bar, camera cutout, Dynamic Island or home indicator
  [HIG-LAYOUT].
- **Pin bottom bars and buttons above the bottom inset,** and extend their background
  colour into it. A tappable control must never overlap the home indicator or gesture bar.
- **In landscape, the cutout is on the side.** Inset content on that side; don't just mirror
  the portrait layout.
- **Lay out against the inset values, not fixed numbers,** because they differ by device and
  navigation mode. On the web, use `viewport-fit=cover` with `env(safe-area-inset-*)`.
- **Design from available size, not device type.** Apple: base layout on size classes, not
  the device or its orientation [HIG-LAYOUT]. Android: phones in portrait are almost all
  "compact" width (under 600 dp) [AND-WSC].

## 5. Keyboard and forms

- **Ask for less.** Cut every field you can, prefill what you can (location, contacts,
  history), and work out values from other data, such as city from postcode [NNG-INPUT].
- **Put the label above the field.** Don't use placeholder text as the label: it disappears
  as people type, hurts memory and looks like a filled-in value [NNG-PLACEHOLDER]
  [BAYMARD-LABELS]. Mark which fields are required or optional [NNG-INPUT].
- **Show the right keyboard for each field.** In 2015, 54% of benchmarked mobile sites
  failed to do this for phone, postcode or card fields [BAYMARD-KEYBOARD]. On the web, set
  `type`, `inputmode` and `autocomplete`. Natively, set the keyboard type and content type
  [HIG-KEYBOARD][HIG-TEXTFIELD].

  | Field | Web | Notes |
  | --- | --- | --- |
  | Email | `type="email" autocomplete="email"` | No autocorrect or auto-capitalisation |
  | Phone | `type="tel" autocomplete="tel"` | Accept any format |
  | One-time code | `inputmode="numeric" autocomplete="one-time-code"` | Lets the OS autofill SMS codes |
  | Card number | `inputmode="numeric" autocomplete="cc-number"` | Accept spaces |
  | Postcode/ZIP | `autocomplete="postal-code"` | Numeric only where the country allows |
  | Search | `type="search" enterkeyhint="search"` | Return key reads "Search" |
  | Password | `type="password" autocomplete="current-password"` / `new-password` | Offer show/hide |

- **Turn off autocorrect for names, addresses and email,** accept typos and any format, and
  format the value for people as they type [NNG-INPUT].
- **Keep the focused field and its error visible above the keyboard,** in both orientations
  [NNG-INPUT]. Sticky headers and footers must not cover the focused element (WCAG 2.2 SC
  2.4.11 Focus Not Obscured) [WCAG-2.4.11].
- **Stack fields in one column** with even spacing and consistent widths [HIG-TEXTFIELD].
  Set the return key to "Next" between fields and to the action ("Go", "Search", "Send") on
  the last one [HIG-KEYBOARD].
- **Validate inline, when people leave a field** (or once a fixed-length value such as a
  postcode is complete), never while they are still typing. Clear the error on the keystroke
  that fixes it, and show a quiet confirmation for valid fields. Say what is wrong and how to
  fix it, next to the field [BAYMARD-INLINE][NNG-ERRORS][WCAG-3.3].
- **Don't make people type things twice** (SC 3.3.7 Redundant Entry), and allow paste and
  password managers at sign-in (SC 3.3.8 Accessible Authentication) [WCAG-3.3].

## 6. Gestures

- **Every gesture needs a visible alternative.** Swipe-to-delete also needs a menu or button;
  swipe-to-dismiss also needs a Close button [HIG-GESTURES][NNG-SWIPE].
- **Don't require multi-finger or path-based gestures.** WCAG SC 2.5.1 needs a single-pointer
  option, and SC 2.5.7 needs an alternative to dragging, such as tap-to-move or up/down
  buttons for reordering [WCAG-2.5].
- **Use contextual swipe mainly for destructive actions,** keep one meaning per direction
  across the app, and confirm or offer undo [NNG-SWIPE].
- **Don't fight system gestures:** screen-edge back swipe, home or app switcher from the
  bottom edge, Control Center or notifications from the top. Keep custom horizontal swipes
  away from the left edge [HIG-GESTURES].

## 7. Typography and Dynamic Type

- **Body text defaults to 17 pt on iOS (11 pt minimum)** [HIG-TYPE]. Material's body large
  is 16 sp [M3-TYPE]. Don't set running text below 16.
- **Use system text styles** (`.body`, `.headline` on iOS; type-scale roles on Android) so
  the text follows the user's size setting [HIG-TYPE].
- **Layouts must survive 200% text** (WCAG SC 1.4.4; Apple asks for at least 200% too)
  [WCAG-1.4.4][HIG-A11Y]. At large sizes, let rows wrap, stack side-by-side items, and let
  bars grow. Don't truncate the information people need.
- **Avoid Ultralight, Thin and Light weights** at text sizes [HIG-TYPE].
- **Keep hierarchy as size changes:** title > headline > body > caption at every Dynamic
  Type step [HIG-TYPE].

## 8. Colour, contrast and dark mode

- **Text contrast at least 4.5:1** (3:1 for 18 pt+ or 14 pt+ bold). Icons, field borders and
  focus rings at least 3:1 [WCAG-1.4][HIG-A11Y][AND-A11Y].
- **Never use colour as the only signal.** Pair it with an icon, text or shape (SC 1.4.1)
  [WCAG-1.4].
- **Support both appearances** and follow the system setting. Light mode reads better for
  most people with normal vision; dark mode helps some low-vision users and suits long reading
  at night. Default to the system, not to dark [HIG-DARK][NNG-DARK].
- **Use semantic colour tokens** (background, label, separator), not raw hex values, so both
  modes and Increase Contrast work. In dark mode, raised surfaces (sheets, popovers) are
  lighter than the base, not darker [HIG-DARK].
- **Check contrast in both modes,** including with Increase Contrast on [HIG-DARK].

## 9. Loading, empty and error states

Design these for every screen that loads data; they are screens, not afterthoughts.

- **Loading.** Respond within 0.1 s; past 1 s show that work is happening; past 10 s show
  progress and let people do something else [NNG-RESPONSE][NNG-PROGRESS]. Show something as
  soon as possible [HIG-LOADING]:
  - Under 1 s: show no indicator.
  - About 2–10 s: use a skeleton for a full screen or a spinner for one module.
  - Over 10 s, or uploads and downloads: use a determinate progress bar [NNG-SKELETON].
  - A skeleton must match the real layout. A blank header-and-footer frame reads as broken
    [NNG-SKELETON].
- **Empty.** Say why it is empty and give the next step: "No saved places yet. Tap ♡ on any
  place to save it." Use first-run empty states to teach the feature [NNG-EMPTY].
- **Error.** Make it visible, near the problem, in plain words, with a way to fix it, and
  keep what people typed [NNG-ERRORS]. Announce status changes to screen readers (SC 4.1.3)
  [WCAG-4.1.3]. Offline: keep cached content visible, mark it as stale, and offer Retry.
- **Partial states.** Show pull-to-refresh, "loading more" at the end of lists, and a failed
  row inside an otherwise good list.

## 10. Motion

- **Respect Reduce Motion:** swap large slides, zooms and parallax for fades, and avoid
  fast-moving or blinking effects [HIG-A11Y][HIG-MOTION].
- **Motion should explain** where something came from or went. Keep transitions short and
  never block input.
