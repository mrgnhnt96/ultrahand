# Tablet canvas presets

A tablet app rarely gets the whole screen. Design every screen at four full-screen tablet
sizes in portrait and landscape. Then design it at the split widths people actually use, and
check a free drag from full width down to the minimum. Sizes are logical units (CSS px =
iOS pt ≈ Android dp), which is what the canvas renders.

## Full-screen presets

| Preset | Portrait (w × h) | Landscape (w × h) | Stands for |
| --- | --- | --- | --- |
| `ipad-mini` | 744 × 1133 | 1133 × 744 | iPad mini, the smallest current iPad |
| `ipad` | 820 × 1180 | 1180 × 820 | iPad 11-inch and iPad Air 11-inch, the most common current iPad in StatCounter [SC-TAB][UYL-IPAD] |
| `ipad-13` | 1032 × 1376 | 1376 × 1032 | iPad Pro 13-inch and Air 13-inch (1024 × 1366), the largest iPads |
| `android-tablet` | 800 × 1280 | 1280 × 800 | 10-inch Android tablets. This is the top tablet resolution in StatCounter and Android's own 10.5-inch reference device [SC-TAB][AND-QUAL] |

## Split widths

Split view, tiling and side-by-side apps give a window a fraction of the screen. The canvas
applies each fraction to the current orientation's width. In landscape:

| Preset | 1/3 | 1/2 | 2/3 | Full |
| --- | --- | --- | --- | --- |
| `ipad-mini` (1133) | 378 · compact | 566 · compact | 755 · medium | 1133 · expanded |
| `ipad` (1180) | 393 · compact | 590 · compact | 787 · medium | 1180 · expanded |
| `ipad-13` (1376) | 459 · compact | 688 · medium | 917 · expanded | 1376 · large |
| `android-tablet` (1280) | 427 · compact | 640 · medium | 853 · expanded | 1280 · large |

In portrait, half width is 372–516 (compact) on every preset. The full portrait widths are
medium (744–820), except `ipad-13`, which is expanded (1032).

The classes are Android's width breakpoints [AND-WSC]: **compact** < 600, **medium**
600–839, **expanded** 840–1199, **large** 1200–1599, **extra-large** ≥ 1600. Apple doesn't
publish point thresholds. iPadOS reports a *compact* horizontal size class for narrow
windows and *regular* for wide ones [HIG-LAYOUT]. Treat Android's compact line (600) as the
switch point for both platforms.

The table shows that one device crosses every class. A half-width window on the most common
iPad is compact, the same as a phone, so a "tablet" design must include the phone layout.

## Free resize

iPadOS 26 windows and Android desktop windowing let people drag a window to any size, and the
split divider moves continuously [HIG-MULTI][AND-MW]. The canvas must let you drag the width
(and, in window mode, the height) and reflow **live** while you drag. Don't snap or reload
at the end.

- **Minimum:** 320 wide, the WCAG reflow width [WCAG-1.4.10]. Android's multi-window example
  sets a minimum of 300 × 450 [AND-MW]. That makes 320 × 450 a safe floor for narrow tiles
  and floating windows such as Slide Over [MR-261].
- **Maximum:** the preset's full width and height in the current orientation. The canvas
  can't vary its limit per preset, so it allows up to the largest preset (1376 × 1376); stop
  each drag at the device's own full size.

Machine-readable form for the canvas (`shared/canvas/README.md` defines every field). The
*Split view* presets open in landscape with the app on the leading side of the divider; the
divider's snaps are the 1/3, 1/2 and 2/3 widths from the table above, and Rotate turns the
whole device (the snaps scale with it). Drag the divider, or focus it and use the arrow
keys to step between snaps. *Full* is the matching full-screen preset rotated to landscape.
`limits` bound free resizing: 320 × 450 at the bottom, the largest preset at the top. The
size classes are the canvas defaults, which are the Android breakpoints above, so they're
not repeated here.

```json
{
  "device": "tablet",
  "platform": "Tablet",
  "initialPreset": "ipad",
  "limits": { "minWidth": 320, "minHeight": 450, "maxWidth": 1376, "maxHeight": 1376 },
  "presets": [
    { "id": "ipad-mini",      "label": "iPad mini · 744",    "group": "Full screen", "width": 744,  "height": 1133, "safeArea": { "top": 24, "bottom": 20, "landscapeSide": 0, "landscapeBottom": 20 }, "platform": "ios" },
    { "id": "ipad",           "label": "iPad 11\" · 820",    "group": "Full screen", "width": 820,  "height": 1180, "safeArea": { "top": 24, "bottom": 20, "landscapeSide": 0, "landscapeBottom": 20 }, "platform": "ios" },
    { "id": "ipad-13",        "label": "iPad 13\" · 1032",   "group": "Full screen", "width": 1032, "height": 1376, "safeArea": { "top": 24, "bottom": 20, "landscapeSide": 0, "landscapeBottom": 20 }, "platform": "ios" },
    { "id": "android-tablet", "label": "Android 10\" · 800", "group": "Full screen", "width": 800,  "height": 1280, "safeArea": { "top": 24, "bottom": 24, "landscapeSide": 0, "landscapeBottom": 24 }, "platform": "android" },
    { "id": "ipad-split",     "label": "iPad split · 590",   "group": "Split view", "width": 590, "height": 820, "safeArea": { "top": 24, "bottom": 20 }, "platform": "ios",
      "split": { "width": 1180, "snaps": [393, 590, 787], "side": "leading", "minOther": 320 } },
    { "id": "ipad-13-split",  "label": "iPad 13\" split · 688", "group": "Split view", "width": 688, "height": 1032, "safeArea": { "top": 24, "bottom": 20 }, "platform": "ios",
      "split": { "width": 1376, "snaps": [459, 688, 917], "side": "leading", "minOther": 320 } },
    { "id": "android-split",  "label": "Android split · 640", "group": "Split view", "width": 640, "height": 800, "safeArea": { "top": 24, "bottom": 24 }, "platform": "android",
      "split": { "width": 1280, "snaps": [427, 640, 853], "side": "leading", "minOther": 320 } }
  ],
  "extraChecks": [
    { "id": "reflow",      "label": "Reflow · 320",                      "width": 320,  "height": 1024 },
    { "id": "keyboard-up", "label": "Landscape, keyboard up · 1180 × 420", "width": 1180, "height": 420 }
  ]
}
```

The canvas shows the current width's size class next to the size, so the designer
sees the layout change at 600 and 840.

Safe areas are typical values: the iPad status bar is about 24 pt and the home indicator
about 20 pt. On Android tablets, the bottom inset grows to about 48 dp when the taskbar is
pinned or 3-button navigation is on. In a window that isn't full screen, iPadOS puts window
controls at the top-leading edge of the toolbar row, so leading toolbar buttons need to
move inward [HIG-WINDOWS]. Lay out against insets, never hard-coded numbers. On the web, use
`env(safe-area-inset-*)`.

## Why these sizes

Source: StatCounter, *Tablet Screen Resolution Stats Worldwide*, October 2026 [SC-TAB].
These are browser viewport sizes, so they count web traffic, not app installs.

| Resolution | Share | Covered by |
| --- | --- | --- |
| 1280 × 800 | 7.96% | `android-tablet` landscape |
| 800 × 1280 | 7.89% | `android-tablet` portrait |
| 768 × 1024 | 7.39% | older 9.7-inch iPads; sits between `ipad-mini` and `ipad` |
| 820 × 1180 | 4.71% | `ipad` |
| 810 × 1080 | 4.66% | iPad 10.2-inch (9th gen); close to `ipad` |
| 601 × 1007 | 4.02% | small Android tablets; just above the 600 compact line |

The long tail is wide, so the presets are anchors, not targets. The free-resize drag covers
everything in between. iPad point sizes come from Apple's published resolutions as collected
by [UYL-IPAD].

## Extra checks

- **Reflow · 320:** at 320 CSS px wide nothing needs horizontal scrolling, except content
  that needs two dimensions, such as maps, data tables and toolbars [WCAG-1.4.10]. This is
  also the floor for a narrow floating window.
- **Keyboard up:** in landscape the on-screen keyboard leaves roughly 400 pt of height (it
  varies by model and keyboard). The
  focused field and its primary action must stay visible [WCAG-2.4.11]. Android's
  height classes call this *compact height* (< 480) [AND-WSC].

## Orientation

Support both orientations unless one is essential, such as a piano app [WCAG-1.3.4].
On Android 16, on screens at least 600 dp wide, the system ignores an app's orientation,
aspect-ratio and resizability limits, so locking is no longer an option there anyway
[AND-MW].
