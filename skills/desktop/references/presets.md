# Desktop canvas presets

A desktop app doesn't get a screen size; it gets a window that people drag to any size
between the minimum you choose and the whole display [WIN-BREAK][HIG-WINDOWS]. The presets
below are anchors for common displays and window arrangements. The real test is the free
drag between your minimum and maximum. Sizes are logical units (CSS px = macOS pt =
Windows epx), which is what the canvas renders.

## Window presets

| Preset | Size (w × h) | Width / height class | Stands for |
| --- | --- | --- | --- |
| `laptop-hd` | 1366 × 768 | large / medium | Budget 14–15.6″ laptops; Microsoft's typical "large" window [SC-DESK][WIN-BREAK] |
| `laptop-125` | 1536 × 864 | large / medium | 1920 × 1080 laptops at the Windows default 125% scale, the second most common desktop size [SC-DESK] |
| `macbook` | 1440 × 900 | large / expanded | 13″ MacBook at its default scaled resolution (newer Airs use 1470 × 956) |
| `desktop-fhd` | 1920 × 1080 | extra-large / expanded | 1080p monitors, about 28% of desktop traffic [SC-DESK] |
| `desktop-qhd` | 2560 × 1440 | extra-large / expanded | 27″ QHD and 5K-class monitors; the default maximum [SC-DESK] |
| `snap-half` | 960 × 1080 | expanded / expanded | A window snapped to half of a 1080p screen (Windows Snap, macOS tiling) |
| `mac-half` | 720 × 900 | medium / expanded | Half of a 13″ MacBook: two apps side by side |
| `browser` | 1280 × 720 | large / medium | A web app in a browser window on a 1366 × 768 or 1280 × 800 laptop [SC-DESK] |

The width classes are the canvas defaults, from Material 3 [AND-WSC]: **compact** < 600,
**medium** 600–839, **expanded** 840–1199, **large** 1200–1599, **extra-large** ≥ 1600.
Height: **compact** < 480, **medium** 480–899, **expanded** ≥ 900.

Windows publishes its own three classes for app windows [WIN-BREAK]: **small** ≤ 640,
**medium** 641–1007, **large** ≥ 1008 epx. Its navigation pane switches at the same lines
[WIN-NAV]. On Windows, put your navigation breakpoints at 641 and 1008 rather than 600 and
840; the canvas readout still shows the Material class, which lands within 40 px of them.
Apple publishes no point thresholds for macOS windows; it asks you to set a minimum and
maximum size and test both [HIG-LAYOUT].

The table shows the point of these presets: a single 1080p monitor gives you a window from
extra-large (maximised) down to expanded (snapped half), and a MacBook's half is medium. A
desktop design is a set of layouts, not one.

## Free resize: choose the minimum and maximum

Every desktop design states its window limits. Put them in the design's `config.json` as
`limits`; the canvas then lets you drag any size between them, live.

- **Minimum (native app):** default **640 × 480**. 640 is the top of Windows' *small* class
  and half of a 1280-wide screen, and 480 is where height stops being *compact* [WIN-BREAK]
  [AND-WSC]. Go lower if the app is a utility people keep beside other windows; go higher
  only when the content truly can't work smaller. Apple: set a minimum so controls don't
  overlap, but "don't use minimum and maximum sizes as a way to prevent resizing"
  [HIG-LAYOUT].
- **Minimum (web app):** **320 × 256**. A browser window can be any size, and people zoom to
  400%: 1280 × 1024 at 400% is 320 × 256 CSS px, and the page must still work there without
  two-way scrolling [WCAG-1.4.10].
- **Maximum:** default **2560 × 1440**. Raise it to 3440 × 1440 or 3840 × 2160 when the app
  targets ultrawide or 4K displays. At large sizes, content stops growing before the window
  does: keep text columns and forms at a readable width and centred [HIG-LAYOUT][WCAG-1.4.8].
  The **max content width** is a design decision you state alongside the window limits.

Machine-readable form for the canvas (`build.mjs --presets` reads this block):

```json
{
  "device": "desktop",
  "platform": "Desktop",
  "minTarget": 24,
  "initialPreset": "laptop-125",
  "limits": { "minWidth": 640, "minHeight": 480, "maxWidth": 2560, "maxHeight": 1440 },
  "sizeClasses": {
    "width": [
      { "name": "compact", "min": 0 },
      { "name": "medium", "min": 600 },
      { "name": "expanded", "min": 840 },
      { "name": "large", "min": 1200 },
      { "name": "extra-large", "min": 1600 }
    ],
    "height": [
      { "name": "compact", "min": 0 },
      { "name": "medium", "min": 480 },
      { "name": "expanded", "min": 900 }
    ]
  },
  "presets": [
    { "id": "laptop-hd",   "label": "Laptop · 1366 × 768",     "width": 1366, "height": 768,  "group": "Laptop",  "platform": "windows", "window": "windows" },
    { "id": "laptop-125",  "label": "Laptop 125% · 1536 × 864", "width": 1536, "height": 864,  "group": "Laptop",  "platform": "windows", "window": "windows" },
    { "id": "macbook",     "label": "MacBook 13″ · 1440 × 900", "width": 1440, "height": 900,  "group": "Laptop",  "platform": "macos",   "window": "mac" },
    { "id": "desktop-fhd", "label": "1080p · 1920 × 1080",     "width": 1920, "height": 1080, "group": "Desktop", "platform": "windows", "window": "windows" },
    { "id": "desktop-qhd", "label": "1440p · 2560 × 1440",     "width": 2560, "height": 1440, "group": "Desktop", "platform": "macos",   "window": "mac" },
    { "id": "snap-half",   "label": "Snap half · 960 × 1080",  "width": 960,  "height": 1080, "group": "Window",  "platform": "windows", "window": "windows" },
    { "id": "mac-half",    "label": "Mac half · 720 × 900",    "width": 720,  "height": 900,  "group": "Window",  "platform": "macos",   "window": "mac" },
    { "id": "browser",     "label": "Browser · 1280 × 720",    "width": 1280, "height": 720,  "group": "Web",     "platform": "web",     "window": "plain" }
  ],
  "extraChecks": [
    { "id": "min-window", "label": "Min window · 640 × 480",  "width": 640,  "height": 480, "window": "plain" },
    { "id": "short",      "label": "Short window · 1366 × 600", "width": 1366, "height": 600, "window": "plain" },
    { "id": "zoom-400",   "label": "400% zoom · 320 × 256",   "width": 320,  "height": 256, "frame": "none", "platform": "web" }
  ]
}
```

To change the limits for one design, override them in `config.json` (its keys win):

```json
{ "limits": { "minWidth": 800, "minHeight": 560, "maxWidth": 3440, "maxHeight": 1440 } }
```

For a web app, also drop the native presets you don't need and lower the minimum:

```json
{ "limits": { "minWidth": 320, "minHeight": 256, "maxWidth": 2560, "maxHeight": 1440 }, "initialPreset": "browser" }
```

Keep the `min-window` check's size in step with `limits` (copy `extraChecks` into
`config.json` and edit it), so one click lands on the minimum you chose.

## Targets

`minTarget` is 24, the WCAG 2.5.8 floor for pointer targets [WCAG-2.5.8]. Desktop controls
are smaller than touch controls, but pointer hit regions extend past the visible control
[HIG-POINTER]. Aim higher where touch is likely: Windows touch targets are about 40 × 40 epx
[WIN-TARGET], and laptops with touchscreens are common. The canvas overlay flags anything
under 24.

## Why these sizes

Source: StatCounter, *Desktop Screen Resolution Stats Worldwide*, October 2026 [SC-DESK].
These are browser screen sizes (CSS px after OS scaling), so they count web traffic.

| Resolution | Share | Covered by |
| --- | --- | --- |
| 1920 × 1080 | 27.82% | `desktop-fhd`; half is `snap-half` |
| 1536 × 864 | 9.13% | `laptop-125` |
| 800 × 600 | 8.85% | Likely automated or virtual-machine traffic; covered by the free drag above the minimum |
| 1366 × 768 | 7.48% | `laptop-hd` |
| 1280 × 720 | 4.44% | `browser` |
| 2560 × 1440 | 3.79% | `desktop-qhd`, the default maximum |

These are screen sizes. A maximised window loses the macOS menu bar or the Windows taskbar
and its own title bar, and a browser loses its tab strip and toolbar, so the content area is
always shorter than the screen. That's why the `short` check exists.

## Extra checks

- **Min window:** the smallest size you allow. Every feature must still be reachable here,
  with panes collapsed rather than overlapping [HIG-LAYOUT][WIN-RESP].
- **Short window · 1366 × 600:** roughly what a browser leaves on a 1366 × 768 laptop.
  Headers, toolbars and sticky footers must not eat the content, and the focused item must
  not hide under them [WCAG-2.4.11]. Avoid critical controls at the window's bottom edge
  [HIG-WINDOWS].
- **400% zoom · 320 × 256:** required for web content [WCAG-1.4.10]. Content reflows to one
  column with vertical scrolling only. Data tables, maps, diagrams and toolbars may scroll in
  two dimensions, but the rest of the page may not. For native apps it doubles as the
  "large text in a small window" stress test.
