# Tablet design principles

Each rule cites a key from [sources.md](sources.md). Where sources disagree, the stricter
number wins. Units: 1 CSS px ≈ 1 pt (iOS) ≈ 1 dp (Android) at the canvas presets.

## 1. Design for window size, not the device

- **Lay out by the window's width class, never by "is this a tablet".** Android's width
  classes (compact < 600, medium 600–839, expanded 840–1199, large 1200+) describe the
  space the app has, which changes at runtime. They are "not intended for isTablet logic"
  [AND-WSC]. Apple says the same: respond to size classes, not to the device or its
  orientation [HIG-LAYOUT].
- **One tablet covers every class.** A half-width window on an 11-inch iPad is compact (590)
  and full landscape is expanded (1180) (see [presets.md](presets.md)). Every tablet design
  therefore needs a compact layout too.
- **Design expanded first, then medium, then compact.** Expanded is where the layout
  decisions live: panes, rails and density. The narrower layouts are reductions of it
  [AND-WSC].
- **Keep the same features at every size.** A narrow window can hide a pane behind
  navigation, but it must not drop a feature [HIG-LAYOUT].

## 2. Reflow live and keep state

- **People resize while they work.** On iPadOS 26 windows resize freely and tile into
  halves, thirds and quarters. Apps "don't control multitasking configurations or receive
  any indication of the ones that people choose" [HIG-MULTI][MS-26]. On Android 12+ every
  app runs in multi-window on medium and expanded screens, and the split divider moves
  continuously [AND-MW].
- **Reflow continuously; never reload or reset.** Scroll position, selection, typed text,
  open sheets and playback survive every resize and every class change [AND-MW][AND-CANON]
  [HIG-MULTI].
- **Keep working when visible but not focused.** In split screen, the inactive app stays on
  screen: video keeps playing and live data keeps updating [AND-MW].
- **Restore context.** Reopen to the same place, because the system remembers window size and
  placement [HIG-MULTI][HIG-WINDOWS].

## 3. Navigation by width

| Width class | Primary navigation |
| --- | --- |
| Compact | Bottom tab bar / navigation bar, as on a phone |
| Medium | Navigation rail (Android) or top tab bar that can become a sidebar (iPadOS) |
| Expanded+ | Rail or sidebar; a permanent drawer or always-visible sidebar if there's room |

- **Switch from a bottom bar to a rail or sidebar once the window is wider than compact.**
  A rail is "easier to reach while holding the left and right sides of the device". The
  Android default keeps a bottom bar only when width *or* height is compact [AND-NAV]
  [AND-T2].
- **On iPad, the tab bar sits near the top and can convert to a sidebar.** Prefer the
  adaptable tab bar to a sidebar, and keep five or fewer tabs so the compact and regular
  layouts match [HIG-TABS][HIG-SIDEBARS].
- **Keep sidebars to two levels at most,** and consider a tab bar first [HIG-SIDEBARS].
- **Don't hide or disable tabs** when a section is empty; explain the empty state inside it
  [HIG-TABS].
- **Keep navigation visible and labelled.** In NN/g's first iPad study, back buttons and a
  home screen helped. Navigation hidden behind a logo failed, and so did screens crowded with
  "too much navigation" [NNG-IPAD].

## 4. Use a canonical layout

Pick one of the three canonical layouts before inventing your own [AND-CANON][M3-CANON].

- **List-detail** (mail, settings, files):
  - Expanded: both panes side by side.
  - Medium and compact: show the list *or* the detail, and Back returns to the list.
  - On narrowing while a detail is open, keep the detail and hide the list. At expanded,
    the item shown in the detail pane counts as open.
  - On widening, show the list with that item still selected.
  - If only the list was showing when the window widens, fill the detail pane with a
    placeholder or the most relevant item. Never leave it blank [AND-CANON][HIG-SPLIT].
- **Supporting pane** (a document with comments, a video with notes):
  - Expanded: main content takes about 70% and the supporting pane about 30%.
  - Medium: split 50/50.
  - Compact: the supporting content goes below the main content or into a bottom sheet.
  - The supporting content only makes sense next to the main content; that is the test
    that separates it from list-detail [AND-CANON].
- **Feed** (photos, products, articles): an adaptive grid with a minimum column width
  (Android's example uses 180 dp). It becomes a single column at compact width. Let
  important items span more columns [AND-CANON][AND-T2].

## 5. Panes and split views

- **Use multi-pane layouts only at regular / medium+ widths.** In a compact environment,
  multiple panes wrap or truncate content [HIG-SPLIT].
- **Default to a 1/3 + 2/3 split, or half and half**, so panes look balanced [HIG-SPLIT].
- **Highlight the selection persistently in each pane** so people know what the detail
  pane shows [HIG-SPLIT].
- **Let people hide panes, and give several ways to bring them back:** a toolbar button, a
  menu command and a keyboard shortcut [HIG-SPLIT].
- **Account for narrow, compact and intermediate widths,** and make it obvious how to move
  between panes at each [HIG-SPLIT].
- **Don't confuse multi-pane with multi-instance.** Two windows of the same app are a
  system feature. Offer "Open in New Window" where it helps, but don't open new windows by
  default [AND-MW][HIG-WINDOWS].

## 6. Multitasking and windows

- **iPadOS 26 (current)** has full-screen apps or freely resizable windows, with
  macOS-style tiling: halves, thirds and quarters [HIG-MULTI][MS-26]. Fixed Split View
  went away in iPadOS 26. Slide Over came back in 26.1 as a single resizable window that
  floats above the others and can be hidden off-screen [MR-261][MSPARKY-SO].
- **Window controls take the top-leading corner of the toolbar row in windowed mode.** Move
  leading toolbar buttons inward so they don't collide [HIG-WINDOWS].
- **iPadOS 26 adds a menu bar,** revealed from the top edge. List the app's commands, its
  tabs or sections (in View) and their keyboard shortcuts there, using the Mac menu
  structure [HIG-MENUBAR].
- **Android** has split screen (side by side, or stacked in portrait), picture-in-picture and
  desktop windowing with free resize [AND-MW]. On Android 16, on screens at least 600 dp wide,
  the system ignores orientation, aspect-ratio and resizability limits [AND-MW].
- **Test the multitasking cases:** entering and leaving split, dragging the divider wider
  and narrower, side by side and stacked, rapid resizing, and text that stays readable
  with UI that doesn't get too small [AND-MW].

## 7. Content width and density

- **Don't stretch.** On large windows, buttons, text fields and bottom sheets get a maximum
  width instead of spanning the screen. Small menus and dialogs don't cover the whole
  screen, and images aren't stretched [AND-T2].
- **Cap line length for reading.** Use multiple columns of text, or a centred column with
  margins, rather than full-width paragraphs [AND-T2].
- **Use the extra space for more content, not bigger content.** People are "typically within
  about 3 feet" of an iPad, and Apple says to set size and density from viewing distance and
  input mode [HIG-IPADOS]. In practice, keep phone-sized text and touch targets, and spend
  the space on panes, columns and context.
- **Margins grow with width.** The commonly cited Material values are 16 dp margins at
  compact and medium width, growing to roughly 24–32 dp at expanded and larger widths. They
  weren't confirmed against the live Material spec, so treat them as approximate
  [M3-CANON].

## 8. Touch targets and reach

- **Targets are at least 44 × 44 pt (iOS) / 48 × 48 dp (Android), never below 24 × 24**
  [HIG-A11Y][AND-T2][WCAG-2.5.8]. A pointer doesn't excuse small targets: the same screen is
  also touched.
- **Read–tap asymmetry:** tablets show text that is easy to read but targets that are too
  small and too close together. This was the most common problem in NN/g's iPad testing
  [NNG-IPAD].
- **Put primary content in the centre, secondary actions along the edges.** People prefer to
  view and touch the centre of the screen. Taps are least accurate in the corners (about
  12 mm targets there, against about 7 mm in the centre) [HOOBER-TOUCH].
- **Two hands hold a tablet by its sides.** Put frequent controls within reach of the side
  edges (a rail, side toolbar items) rather than only along the top centre [AND-NAV].
- **Guard against accidental touches.** Hands resting on the edges and swipes that are
  ambiguous with scrolling caused errors in testing [NNG-IPAD].
- **Assume a shared device.** Tablets are often used by several people in a household, so
  account switching and privacy matter more than on a phone [NNG-IPAD].

## 9. Pointer and trackpad

- **The pointer adds to touch; it doesn't replace it.** Every action must still work by
  touch, and no information can appear only on hover [HIG-POINTER].
- **Give every interactive element a hover state.** Use the system highlight and lift
  effects for controls, and hover (tint, with scale only where there's room) for large
  elements [HIG-POINTER][AND-T2].
- **Show an I-beam over editable text, and reveal minimised controls on hover,** such as a
  video scrubber [HIG-POINTER].
- **Secondary click (right-click or two-finger tap) opens a context menu** next to the
  selected item [AND-T2]. Touch-and-hold opens the same menu, so touch users get it too,
  and every command in it also exists elsewhere [HIG-CONTEXT].
- **Support rectangle drag-select and modifier-click** for multiple selection where lists
  allow it [HIG-POINTER].
- **Support Ctrl/⌘-scroll and pinch to zoom content** where zoom makes sense [AND-T2].

## 10. Keyboard

- **Every main flow works with the keyboard alone.** Tab and the arrow keys move focus, and
  focus is always visible, including on custom controls [WCAG-2.1.1][WCAG-2.4.7][AND-T2].
  On iPadOS, give arrow-key navigation to text fields, lists, collections and sidebars, and
  leave buttons and switches to Full Keyboard Access [HIG-KEYBOARD].
- **Support the standard shortcuts and never repurpose them:** select all, cut, copy, paste,
  undo, redo, find, new and close [HIG-KEYBOARD][AND-T2].
- **Esc closes modals and menus, clears search, deselects and cancels edits.** Enter sends in
  messaging apps, and Space plays and pauses media [AND-T2].
- **Add custom shortcuts only for the most frequent commands,** using Command as the main
  modifier (modifier order: Control, Option, Shift, Command). Show them in the menu bar
  [HIG-KEYBOARD][HIG-MENUBAR].
- **Support Full Keyboard Access** so people can reach everything without a pointer
  [HIG-KEYBOARD].

## 11. Drag and drop

- **Support dragging within the app and between apps side by side,** such as images, text,
  files and list items [HIG-DND][AND-MW].
- **Every drag has a non-drag alternative,** such as a menu command, a Move button or Copy and
  Paste [HIG-DND][WCAG-2.5.7].
- **Move within a container; copy between containers.** Show valid destinations while
  dragging, auto-scroll near edges, allow multi-item drags, and keep the selection after a
  drop [HIG-DND].
- **Make drops undoable** [HIG-DND].

## 12. Orientation

- **Support both orientations** unless one is essential [WCAG-1.3.4]. Android 16 ignores
  orientation locks on large screens anyway [AND-MW].
- **Rotation is just a resize.** Landscape is usually expanded and portrait medium (except
  13-inch iPads, which are expanded in both), so the same width rules apply
  [AND-WSC][HIG-LAYOUT].
- **Check landscape with the keyboard up.** Height becomes compact (< 480), so the focused
  field and its action must stay visible [AND-WSC][WCAG-2.4.11].

## 13. Modals and sheets

- **Use fewer modals than on a phone.** Apple advises "minimizing modal interfaces and
  full-screen transitions" on iPad, because they hide the context people want to keep
  [HIG-IPADOS].
- **Present sheets and dialogs at a sensible size,** centred or as a form sheet, not full
  screen. Popovers and menus anchor to what opened them [AND-T2][HIG-IPADOS].
- **At compact width, fall back to the phone behaviour:** a full-height sheet or a pushed
  screen.

## 14. Accessibility

- **Text scales to 200% without losing content or function.** Test the largest and smallest
  Dynamic Type sizes in each width class [WCAG-1.4.4][HIG-LAYOUT].
- **Contrast is at least 4.5:1 for text and 3:1 for UI, in light and dark mode.** Never use
  colour as the only signal [WCAG-1.4][HIG-A11Y].
- **Content reflows to 320 wide** without two-dimensional scrolling [WCAG-1.4.10].
- **Gestures have visible alternatives** [WCAG-2.5.7][HIG-A11Y].
