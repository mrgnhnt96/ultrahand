# Desktop design principles

Each rule cites a key from [sources.md](sources.md). Where sources disagree, the stricter
number wins. Units: 1 CSS px ≈ 1 pt (macOS) ≈ 1 epx (Windows) at the canvas presets.

## 1. Design for the window, not the screen

- **A desktop app gets a window, and people resize it.** Base layout decisions on the
  window's width, not the display's. Typical Windows app windows run from 1024 × 640 to
  1920 × 1080 [WIN-BREAK]. A window should "adapt fluidly" as it changes size
  [HIG-WINDOWS].
- **Choose a minimum and a maximum window size, then test both.** The minimum stops
  controls from overlapping or clipping. The maximum stops layouts from becoming unwieldy.
  "Don't use minimum and maximum sizes as a way to prevent resizing" [HIG-LAYOUT]. A web app
  has no minimum: browser windows can be any size, and 400% zoom makes a 1280-wide window
  320 CSS px wide [WCAG-1.4.10]. See [presets.md](presets.md) for defaults.
- **Keep every feature at every size.** A narrow window can collapse a pane or move
  commands into overflow, but nothing becomes unreachable [WIN-RESP][HIG-SIDEBARS].
- **Don't resize the window for people.** Respect the size they chose [HIG-FULLSCREEN].

## 2. Breakpoints and live reflow

- **Material width classes are the canvas default** [AND-WSC]: compact < 600, medium
  600–839, expanded 840–1199, large 1200–1599, extra-large ≥ 1600.
- **On Windows, use Windows' own lines** [WIN-BREAK]: small ≤ 640, medium 641–1007, large
  ≥ 1008 epx. NavigationView changes mode at exactly these widths [WIN-NAV].
- **macOS has no published thresholds.** Set breakpoints where the content stops fitting,
  between your minimum and maximum [HIG-LAYOUT].
- **Use the six responsive techniques** [WIN-RESP]: *reposition* (move a pane below
  another), *resize* (let a column grow), *reflow* (more or fewer columns), *show/hide*
  (labels, secondary panes), *replace* (sidebar → rail → menu button), and *re-architect*
  (list-detail → list then detail).
- **Reflow live; never reset.** Scroll position, selection, typed text, open panels and
  undo history survive every resize and every class change. A breakpoint changes layout,
  not state [WIN-RESP][AND-CANON].
- **Height matters too.** A maximised browser on a 1366 × 768 laptop leaves around 600 px
  of content. Below a medium height class (< 480), collapse toolbars and headers before
  shrinking content [AND-WSC].

## 3. Max content width and line length

- **Let the window grow, but not the text.** At large sizes keep content centred and
  restrict text width [HIG-LAYOUT]. Body text should stay at or under **80 characters** a
  line [WCAG-1.4.8].
- **Grow by adding panes and columns, not by stretching.** Extra width goes to a sidebar, an
  inspector, a second pane or more grid columns [AND-CANON][HIG-SPLIT]. Forms, dialogs,
  buttons and text fields keep a max width.
- **State the max content width** with the window limits; it's a design decision, not an
  implementation detail.

## 4. Multi-pane layouts, split views and sidebars

- **Start from a canonical layout** [AND-CANON]: *list-detail* (mail, files, settings),
  *supporting pane* (editor plus inspector or chat), or *feed* (a grid of cards). A single
  pane suits focused documents.
- **Split views** have dividers people can drag, each pane has a minimum and maximum width,
  and panes can be hidden with a toolbar button, a menu command *and* a keyboard shortcut
  [HIG-SPLIT].
- **Selection persists.** The selected item stays highlighted in its pane while another pane
  shows its detail [HIG-SPLIT]. When list-detail narrows to one pane, keep the open detail;
  when it widens, select that item in the list [AND-CANON].
- **Sidebars** show by default, can be hidden, have at most two levels, and collapse as the
  window narrows [HIG-SIDEBARS]. Remember the width people dragged them to.
- **Never leave a pane empty.** With nothing selected, a detail pane shows a helpful empty
  state or the first item.

## 5. Navigation by width

| Window width | Windows NavigationView (Auto) [WIN-NAV] | Typical pattern |
| --- | --- | --- |
| ≥ 1008 | Left pane expanded, labels shown | Sidebar with labels |
| 641–1007 | Compact: icon rail | Rail, or sidebar overlaying content when opened |
| ≤ 640 | Minimal: a menu button only | Menu button or top tabs; one pane at a time |

- **Top navigation** suits five or fewer equally important categories; use the left pane for
  more, or for categories that change [WIN-NAV].
- **Content margins** are 24 epx, or 12 in the minimal mode [WIN-NAV].
- **Don't hide the main navigation behind a hamburger** when the window has room for it
  [WIN-NAV][NNG-CONTEXT].

## 6. Menus and commands

- **On macOS every command lives in the menu bar**, in the standard order: *App, File, Edit,
  Format, View,* app-specific menus*, Window, Help* [HIG-MENUBAR][HIG-MACOS].
- **Disable unavailable items; don't hide them**, so people learn where commands live.
  Commands that need more input before they run end with an ellipsis ("Export…")
  [HIG-MENUBAR].
- **Show the shortcut beside each menu item** [HIG-MENUBAR][WIN-KEYS].
- **Windows apps and web apps** without a menu bar put commands in a command bar or toolbar
  with an overflow ("More") menu. A web app that builds a menu bar must follow the ARIA
  menubar keyboard pattern: arrow keys inside, Tab out [APG-MENUBAR].

## 7. Toolbars and overflow

- **Group toolbar items into leading, centre and trailing sections**, three groups at most
  [HIG-TOOLBARS].
- **Overflow in a planned order as the window narrows.** Decide which items move into the
  overflow menu first; the primary action goes last [HIG-TOOLBARS][WIN-RESP].
- **Every toolbar item is also in a menu**, so the toolbar can be hidden or customised
  without losing a command [HIG-TOOLBARS].
- **Icon-only buttons need an accessible name and a tooltip** with the shortcut
  ("Bold (Ctrl+B)") [WIN-KEYS][NNG-TOOLTIP].

## 8. Context menus and right-click

- **Secondary click opens a context menu** on anything with object-specific actions:
  rows, files, text, canvas items [HIG-POINTER][HIG-CONTEXT].
- **Keep it short and relevant:** fewer than 10–12 items, frequent first, destructive last,
  one submenu level at most [NNG-CONTEXT][HIG-CONTEXT].
- **Every context-menu command is also available elsewhere** (menu bar, toolbar or a
  keyboard shortcut). The context menu is a shortcut, never the only way [HIG-CONTEXT]
  [NNG-CONTEXT].
- **Hide items that don't apply** (except Cut, Copy and Paste) rather than disabling them;
  this is the opposite of the menu bar rule [HIG-CONTEXT].
- **Keyboard access:** the same menu opens on the focused item from the keyboard (Shift+F10
  or the Menu key on Windows and the web), and its commands act on that focused item
  [WCAG-2.1.1].

## 9. Keyboard shortcuts and focus

- **Everything works from the keyboard,** with no traps [WCAG-2.1.1][WCAG-2.1.2]. Tab moves
  between panes and groups, arrows move within a list, grid, menu or toolbar, Enter
  activates and Esc closes, cancels or clears [APG-KEYS][APG-GRID].
- **Focus is always visible** [WCAG-2.4.7][HIG-FOCUS] and never hidden under a sticky
  header, footer or toolbar [WCAG-2.4.11]. Focus order follows reading order [WCAG-2.4.3].
  Don't move focus without a user action [HIG-FOCUS][WCAG-3.2.1].
- **Keep the standard shortcuts** and don't repurpose them [HIG-KEYBOARD][WIN-KEYS]:

  | Action | macOS | Windows / web |
  | --- | --- | --- |
  | New, open, save, close | ⌘N, ⌘O, ⌘S, ⌘W | Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+W |
  | Undo, redo | ⌘Z, ⇧⌘Z | Ctrl+Z, Ctrl+Y |
  | Cut, copy, paste, select all | ⌘X, ⌘C, ⌘V, ⌘A | Ctrl+X, Ctrl+C, Ctrl+V, Ctrl+A |
  | Find, print | ⌘F, ⌘P | Ctrl+F, Ctrl+P |
  | Rename, refresh, next pane | — | F2, F5, F6 |
  | Zoom in, out, reset | ⌘+, ⌘−, ⌘0 | Ctrl+plus, Ctrl+minus, Ctrl+0 |
  | Full screen | ⌃⌘F | F11 (browsers) |

  In a web app, the browser keeps some keys (Ctrl or ⌘ + N, T, W, and Ctrl+Tab), and the
  page never sees them. Give those commands another shortcut or none.

- **Add custom shortcuts only for frequent commands** [HIG-KEYBOARD][NNG-EFFICIENCY]. On
  macOS, Command is the main modifier and Shift the secondary; use Option sparingly and avoid
  Control. List modifiers in the order Control, Option, Shift, Command [HIG-KEYBOARD].
- **Show shortcuts where people look:** in menus and in tooltips [WIN-KEYS]. Shortcuts are an
  accelerator for experts, not the only route [NNG-EFFICIENCY].
- **Single-key shortcuts** (no modifier) must be turn-off-able or remappable, or active only
  when their component has focus [WCAG-2.1.4].
- **Web apps** add a "skip to main content" link and landmarks so keyboard users can bypass
  repeated navigation [WCAG-2.4.1][NNG-KEYBOARD].

## 10. Pointer, hover and tooltips

- **Every interactive element has a hover state** and a pointer cursor that matches what it
  does (link, text, resize, drag) [HIG-POINTER].
- **Nothing is available only on hover.** Hover-revealed row actions must also be reachable
  by keyboard focus and in the context menu; touch laptops have no hover [NNG-TOOLTIP]
  [WCAG-2.1.1].
- **Tooltips are for brief help, never vital information** [NNG-TOOLTIP]. Content that
  appears on hover or focus must be **dismissible** (Esc), **hoverable** (the pointer can move
  onto it) and **persistent** (it stays until dismissed or no longer relevant)
  [WCAG-1.4.13].
- **Big, close targets are faster** (Fitts's law): put frequent actions near where the
  pointer already is; screen edges and corners are the easiest targets of all [NNG-FITTS].
- **Pointer actions trigger on release** so people can slide off to cancel [WCAG-2.5.2]. Any
  drag has a single-pointer alternative (see §14) [WCAG-2.5.7].

## 11. Density, spacing and targets

- **Targets are at least 24 × 24 CSS px**, or have enough spacing around them [WCAG-2.5.8].
  Desktop controls can be this small because the pointer is precise and hit regions extend
  past the visible control [HIG-POINTER].
- **Where touch is likely** (2-in-1s, touch laptops), use about 40 × 40 epx targets
  [WIN-TARGET].
- **Use a 4 px grid** [WIN-BREAK]. Windows spacing [WIN-SPACING]: 8 between buttons and
  between a control and its header, 12 between a control and its label and between content
  areas, 16 from a surface edge to its text.
- **Density follows the task.** Dense tables, lists and toolbars suit expert, repeated work;
  forms and first-run screens get more space. If you offer a compact mode, keep targets ≥ 24
  and keep text sizes the same [WCAG-2.5.8][WCAG-1.4.4].

## 12. Scrolling regions

- **Scroll the content, not the chrome.** Toolbars, the sidebar and table headers stay put
  while the content pane scrolls. Each pane scrolls independently.
- **Don't nest scroll areas that scroll the same way** [HIG-SCROLL]. Make scrollable areas
  look scrollable, for example with a partly visible item at the edge [HIG-SCROLL].
- **Put the important content first.** On a 1920 × 1080 screen, 57% of viewing time is above
  the fold and 74% in the first two screenfuls [NNG-SCROLL].
- **Tables freeze their header row and, when wide, their first column** [NNG-TABLES].
  Horizontal scrolling is acceptable inside a data table or canvas, never for the page
  [WCAG-1.4.10].
- **Sticky bars are short.** In a short window (≈ 600 high), headers, toolbars and footers
  together must leave most of the height for content, and a focused item must never sit
  under them [WCAG-2.4.11].
- **Keep critical controls out of the window's bottom edge**; the bottom bar is for status
  [HIG-WINDOWS].

## 13. Dialogs, sheets, popovers vs inline editing and side panels

Prefer the least interruptive option that fits the task [HIG-MACOS][NNG-MODAL]:

| Need | Use | Source |
| --- | --- | --- |
| Edit one field or a cell | Inline editing; Enter saves, Esc cancels; the row looks different in edit mode | [NNG-TABLES] |
| View or edit a whole record while seeing the list | Side panel (inspector) beside the table | [NNG-TABLES][AND-CANON] |
| Small, related info or a few options | Popover, closes on outside click without losing work | [HIG-POPOVERS] |
| A short, focused task that blocks the document | Sheet or modal dialog with Done/Cancel | [HIG-SHEETS][APG-DIALOG] |
| Repeated input while working (Find, Inspector) | A panel or non-modal window | [HIG-PANELS][HIG-SHEETS] |
| A complex or long flow | A new window or a full page, not a modal | [HIG-SHEETS][NNG-MODAL] |
| A destructive, irreversible action | Confirmation dialog naming the action ("Delete 3 files") | [NNG-CONFIRM][HIG-ALERTS] |
| Anything that can be undone | No confirmation; do it and offer Undo | [HIG-ALERTS][NNG-CONTROL] |

- **Modals are for critical warnings and for information needed to continue,** not for
  nonessential content, complex decisions or interrupting high-stakes work [NNG-MODAL].
  "We generally don't recommend modals for deep editing work" [NNG-TABLES].
- **One sheet or alert at a time,** and never at launch [HIG-SHEETS][HIG-ALERTS]. Overused
  confirmations get clicked through without reading [NNG-CONFIRM].
- **Modal dialogs trap focus while open,** start focus on the first useful control, close on
  Esc and return focus to what opened them [APG-DIALOG].
- **Cancel abandons the task and discards changes; Close just dismisses the view.** Label
  buttons so the difference is clear [NNG-CANCEL].
- **Batch actions:** checkboxes on rows plus a toolbar that acts on the selection
  [NNG-TABLES]. Support Shift-click range and Ctrl/⌘-click multi-select.

## 14. Drag and drop

- **Every drag has a single-pointer alternative**: a menu command, a Move to… dialog,
  buttons or cut and paste [WCAG-2.5.7]. Keyboard reordering is needed too, but doesn't
  count as that alternative [WCAG-2.1.1]. For a pane divider, offer width presets or a
  Reset command beside the arrow keys.
- **Show what can be dropped where,** preview the result, and make the move undoable
  [NNG-CONTROL].

## 15. Accessibility in both schemes

- **Contrast:** at least 4.5:1 for text (3:1 for large text) and 3:1 for UI parts, focus
  indicators and meaningful graphics, in light **and** dark mode [WCAG-1.4.3][WCAG-1.4.11].
- **Text resize:** text scales to 200% without losing content or function [WCAG-1.4.4], and
  layouts survive user text spacing [WCAG-1.4.12].
- **Reflow:** web content works at 320 CSS px wide with no two-way scrolling, apart from
  tables, maps and diagrams [WCAG-1.4.10].
