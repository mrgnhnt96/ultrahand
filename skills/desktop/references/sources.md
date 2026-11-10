# Sources

The citation keys used in [principles.md](principles.md) and [presets.md](presets.md).
Platform guidelines are living documents; they were checked in November 2026.

## Apple (macOS)

| Key | Source |
| --- | --- |
| HIG-MACOS | Apple, *HIG: Designing for macOS* (more content and fewer nested levels, less modality, every command in the menu bar, keyboard shortcuts). https://developer.apple.com/design/human-interface-guidelines/designing-for-macos |
| HIG-WINDOWS | Apple, *HIG: Windows* (adapt fluidly to size changes, main/key/inactive states, avoid custom frames, no critical controls in the bottom bar, open in new window). https://developer.apple.com/design/human-interface-guidelines/windows |
| HIG-LAYOUT | Apple, *HIG: Layout* (minimum and maximum window sizes, don't use them to stop resizing, keep content centred and text width restricted at large sizes, test the smallest and largest sizes). https://developer.apple.com/design/human-interface-guidelines/layout |
| HIG-MENUBAR | Apple, *HIG: The menu bar* (standard menu order, disable rather than hide, ellipsis for commands that need more input, show shortcuts). https://developer.apple.com/design/human-interface-guidelines/the-menu-bar |
| HIG-TOOLBARS | Apple, *HIG: Toolbars* (leading, centre and trailing groups, overflow order as the window narrows, customisation, every item also in the menu bar). https://developer.apple.com/design/human-interface-guidelines/toolbars |
| HIG-CONTEXT | Apple, *HIG: Context menus* (relevant and few, also available elsewhere, one submenu level, destructive items last). https://developer.apple.com/design/human-interface-guidelines/context-menus |
| HIG-SPLIT | Apple, *HIG: Split views* (draggable dividers, pane minimum and maximum sizes, hideable panes with a button, menu command and shortcut, persistent selection). https://developer.apple.com/design/human-interface-guidelines/split-views |
| HIG-SIDEBARS | Apple, *HIG: Sidebars* (two levels at most, hideable but shown by default, collapse as the window narrows). https://developer.apple.com/design/human-interface-guidelines/sidebars |
| HIG-KEYBOARD | Apple, *HIG: Keyboards* (Full Keyboard Access, standard shortcuts, custom shortcuts only for frequent commands, modifier order). https://developer.apple.com/design/human-interface-guidelines/keyboards |
| HIG-POINTER | Apple, *HIG: Pointing devices* (hit regions padded beyond the visible control, secondary click opens a context menu, avoid gratuitous pointer effects). https://developer.apple.com/design/human-interface-guidelines/pointing-devices |
| HIG-SHEETS | Apple, *HIG: Sheets* (one at a time, Done and Cancel, complex flows in a new window, panels for repeated input such as Find and Replace). https://developer.apple.com/design/human-interface-guidelines/sheets |
| HIG-ALERTS | Apple, *HIG: Alerts* (use sparingly, not for undoable actions, not at launch). https://developer.apple.com/design/human-interface-guidelines/alerts |
| HIG-PANELS | Apple, *HIG: Panels* (non-modal auxiliary windows for inspectors and tools). https://developer.apple.com/design/human-interface-guidelines/panels |
| HIG-POPOVERS | Apple, *HIG: Popovers* (small amounts of information, close on outside click while keeping work, one at a time, not for warnings). https://developer.apple.com/design/human-interface-guidelines/popovers |
| HIG-FULLSCREEN | Apple, *HIG: Going full screen* (Control-Command-F, don't resize windows programmatically). https://developer.apple.com/design/human-interface-guidelines/going-full-screen |
| HIG-SCROLL | Apple, *HIG: Scroll views* (make scrollable areas apparent, don't nest scroll views of the same orientation, auto-scroll only as needed). https://developer.apple.com/design/human-interface-guidelines/scroll-views |
| HIG-FOCUS | Apple, *HIG: Focus and selection* (don't move focus without a user action, visible focus ring). https://developer.apple.com/design/human-interface-guidelines/focus-and-selection |

## Microsoft (Windows)

| Key | Source |
| --- | --- |
| WIN-BREAK | Microsoft Learn, *Screen sizes and breakpoints* (small ≤ 640, medium 641–1007, large ≥ 1008 epx; design for the window, not the screen; typical windows 1024 × 640, 1366 × 768, 1920 × 1080; multiples of 4 epx). https://learn.microsoft.com/en-us/windows/apps/design/layout/screen-sizes-and-breakpoints-for-responsive-design |
| WIN-RESP | Microsoft Learn, *Responsive design techniques* (reposition, resize, reflow, show/hide, re-architect, replace UI). https://learn.microsoft.com/en-us/windows/apps/design/layout/responsive-design |
| WIN-NAV | Microsoft Learn, *NavigationView* (top nav for ≤ 5 equal categories; Auto mode: expanded left pane ≥ 1008, compact icon rail 641–1007, minimal menu button ≤ 640; content margins 24, or 12 in minimal mode). https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview |
| WIN-SPACING | Microsoft Learn, *Content layout and spacing* (8 epx between buttons and between a control and its header, 12 epx between content areas, 16 epx from surface edge to text). https://learn.microsoft.com/en-us/windows/apps/design/basics/content-basics |
| WIN-TARGET | Microsoft Learn, *Guidelines for targeting* (7.5 mm ≈ 40 × 40 epx touch targets; larger for frequent or error-prone targets). https://learn.microsoft.com/en-us/windows/apps/develop/input/guidelines-for-targeting |
| WIN-KEYS | Microsoft Learn, *Keyboard accelerators* (accelerators for common actions, shown in menu labels and tooltips, scoped accelerators, don't override control defaults, localise, common shortcut table). https://learn.microsoft.com/en-us/windows/apps/develop/input/keyboard-accelerators |

## Material Design (web and Android desktop windows)

| Key | Source |
| --- | --- |
| AND-WSC | Android Developers, *Window size classes* (width: compact < 600, medium 600–839, expanded 840–1199, large 1200–1599, extra-large ≥ 1600; height: compact < 480, medium 480–899, expanded ≥ 900). https://developer.android.com/develop/ui/compose/layouts/adaptive/window-size-classes |
| AND-CANON | Android Developers, *Canonical layouts* (list-detail, supporting pane, feed). https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts |
| AND-NAV | Android Developers, *Build adaptive navigation* (bar, rail or drawer by width). https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation |

## Standards

| Key | Source |
| --- | --- |
| WCAG-1.4.3 | W3C, *Understanding SC 1.4.3 Contrast (Minimum)*, AA, 4.5:1 text. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html |
| WCAG-1.4.4 | W3C, *Understanding SC 1.4.4 Resize Text*, AA, 200% without loss. https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html |
| WCAG-1.4.8 | W3C, *Understanding SC 1.4.8 Visual Presentation*, AAA, lines no wider than 80 characters. https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html |
| WCAG-1.4.10 | W3C, *Understanding SC 1.4.10 Reflow*, AA, 320 CSS px wide (vertical content) or 256 CSS px tall (horizontal content), the same as 1280 × 1024 at 400% zoom; two-dimensional content such as data tables, maps and toolbars excepted. https://www.w3.org/WAI/WCAG22/Understanding/reflow.html |
| WCAG-1.4.11 | W3C, *Understanding SC 1.4.11 Non-text Contrast*, AA, 3:1 for UI and focus indicators. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html |
| WCAG-1.4.12 | W3C, *Understanding SC 1.4.12 Text Spacing*, AA. https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html |
| WCAG-1.4.13 | W3C, *Understanding SC 1.4.13 Content on Hover or Focus*, AA: dismissible, hoverable, persistent. https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html |
| WCAG-2.1.1 | W3C, *Understanding SC 2.1.1 Keyboard*, A. https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html |
| WCAG-2.1.2 | W3C, *Understanding SC 2.1.2 No Keyboard Trap*, A. https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html |
| WCAG-2.1.4 | W3C, *Understanding SC 2.1.4 Character Key Shortcuts*, A: single-key shortcuts can be turned off, remapped or work only on focus. https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html |
| WCAG-2.4.1 | W3C, *Understanding SC 2.4.1 Bypass Blocks*, A. https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html |
| WCAG-2.4.3 | W3C, *Understanding SC 2.4.3 Focus Order*, A. https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html |
| WCAG-2.4.7 | W3C, *Understanding SC 2.4.7 Focus Visible*, AA. https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html |
| WCAG-2.4.11 | W3C, *Understanding SC 2.4.11 Focus Not Obscured (Minimum)*, AA: sticky headers, toolbars and panels must not hide the focused item. https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html |
| WCAG-2.5.2 | W3C, *Understanding SC 2.5.2 Pointer Cancellation*, A: act on the up-event. https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html |
| WCAG-2.5.7 | W3C, *Understanding SC 2.5.7 Dragging Movements*, AA: a single-pointer alternative to every drag. https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html |
| WCAG-2.5.8 | W3C, *Understanding SC 2.5.8 Target Size (Minimum)*, AA, 24 × 24 CSS px or enough spacing. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| WCAG-3.2.1 | W3C, *Understanding SC 3.2.1 On Focus*, A: focus alone doesn't change context. https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html |
| APG-DIALOG | W3C WAI-ARIA Authoring Practices, *Dialog (Modal) pattern* (focus moves in, Tab is contained, Esc closes, focus returns). https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ |
| APG-MENUBAR | W3C WAI-ARIA Authoring Practices, *Menu and Menubar pattern* (arrow keys move within menus). https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ |
| APG-KEYS | W3C WAI-ARIA Authoring Practices, *Developing a keyboard interface* (one Tab stop per composite widget, arrows inside it). https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ |
| APG-GRID | W3C WAI-ARIA Authoring Practices, *Grid pattern* (keyboard navigation and editing in data grids). https://www.w3.org/WAI/ARIA/apg/patterns/grid/ |

## Research

| Key | Source |
| --- | --- |
| NNG-MODAL | Nielsen Norman Group, *Modal & Nonmodal Dialogs: When (& When Not) to Use Them* (modals for critical warnings and information needed to continue; not for nonessential information or complex decisions). https://www.nngroup.com/articles/modal-nonmodal-dialog/ |
| NNG-CONFIRM | Nielsen Norman Group, *Confirmation Dialogs Can Prevent User Errors — If Not Overused* (an interruption that pays off only when it prevents a serious error; overused, people agree automatically). https://www.nngroup.com/articles/confirmation-dialog/ |
| NNG-TOOLTIP | Nielsen Norman Group, *Tooltip Guidelines* (never for vital information, brief and useful, mouse and keyboard hover, don't cover related content). https://www.nngroup.com/articles/tooltip-guidelines/ |
| NNG-CONTEXT | Nielsen Norman Group, *Contextual Menus* (small relevant set, frequent items first, fewer than 10–12 items, also in the main menu, not behind gear or hamburger icons). https://www.nngroup.com/articles/contextual-menus/ |
| NNG-TABLES | Nielsen Norman Group, *Data Tables: Four Major User Tasks* (find, compare, view/edit a row, act on records; frozen header and first column; inline edit vs side panel vs modal; batch actions). https://www.nngroup.com/articles/data-tables/ |
| NNG-KEYBOARD | Nielsen Norman Group, *Keyboard-Only Navigation for Improved Accessibility* (visible focus, every control reachable, skip links). https://www.nngroup.com/articles/keyboard-accessibility/ |
| NNG-EFFICIENCY | Nielsen Norman Group, *Flexibility and Efficiency of Use (Usability Heuristic #7)* (accelerators for experts that novices don't need to learn). https://www.nngroup.com/articles/flexibility-efficiency-heuristic/ |
| NNG-CONTROL | Nielsen Norman Group, *User Control and Freedom (Usability Heuristic #3)* (undo, clear exits). https://www.nngroup.com/articles/user-control-and-freedom/ |
| NNG-FITTS | Nielsen Norman Group, *Fitts's Law and Its Applications in UX*. https://www.nngroup.com/articles/fitts-law/ |
| NNG-SCROLL | Nielsen Norman Group, *Scrolling and Attention* (57% of viewing time above the fold, 74% in the first two screenfuls, measured on 1920 × 1080). https://www.nngroup.com/articles/scrolling-and-attention/ |
| NNG-CANCEL | Nielsen Norman Group, *Cancel vs Close: Design to Distinguish the Difference*. https://www.nngroup.com/articles/cancel-vs-close/ |
| DOW-PARALLEL | Steven P. Dow et al., "Parallel prototyping leads to better design results, more divergence, and increased self-efficacy", *ACM TOCHI* 17(4), 2010 (several prototypes made and critiqued in parallel beat serial iteration on one). Used by the explore stage. https://doi.org/10.1145/1879831.1879836 |
| NNG-PARALLEL | Jakob Nielsen, "Parallel & Iterative Design + Competitive Testing = High Usability", NN/g, 17 Jan 2011 (3–5 rough alternatives at once, then merge the best ideas). Used by the explore stage. https://www.nngroup.com/articles/parallel-and-iterative-design/2011/ |

## Usage data

| Key | Source |
| --- | --- |
| SC-DESK | StatCounter, *Desktop Screen Resolution Stats Worldwide*, October 2026. https://gs.statcounter.com/screen-resolution-stats/desktop/worldwide |
