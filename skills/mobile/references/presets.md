# Mobile canvas presets

Design every screen at these three phone sizes, in portrait and landscape. Sizes are
logical units (CSS px = iOS pt ≈ Android dp), which is what the canvas renders.

| Preset | Portrait (w × h) | Landscape (w × h) | Stands for |
| --- | --- | --- | --- |
| `small` | 360 × 800 | 800 × 360 | Compact Android, the most common Android width (Galaxy S/A default, many mid-range phones) |
| `medium` | 393 × 852 | 852 × 393 | Current standard iPhones and many Pixels (390–402 wide cluster) |
| `large` | 430 × 932 | 932 × 430 | Plus/Pro Max iPhones and large Android phones (412–440 wide cluster) |

Machine-readable form for the canvas:

```json
{
  "device": "mobile",
  "presets": [
    { "id": "small",  "label": "Small · 360",  "width": 360, "height": 800, "safeArea": { "top": 24, "bottom": 24, "landscapeSide": 24, "landscapeBottom": 24 }, "platform": "android" },
    { "id": "medium", "label": "Medium · 393", "width": 393, "height": 852, "safeArea": { "top": 59, "bottom": 34, "landscapeSide": 59, "landscapeBottom": 21 }, "platform": "ios" },
    { "id": "large",  "label": "Large · 430",  "width": 430, "height": 932, "safeArea": { "top": 59, "bottom": 34, "landscapeSide": 59, "landscapeBottom": 21 }, "platform": "ios" }
  ],
  "orientations": ["portrait", "landscape"],
  "extraChecks": [{ "id": "reflow", "label": "Reflow · 320", "width": 320, "height": 568 }]
}
```

Safe-area numbers are typical values for a device with a camera cutout and gesture
navigation. Real insets vary by model (for example, an Android phone with 3-button navigation
reserves about 48 dp at the bottom), so lay out against the inset, never against a hard-coded
number. On the web, use `viewport-fit=cover` and `env(safe-area-inset-*)`.

## Why these three

Source: StatCounter, *Mobile Screen Resolution Stats Worldwide*, October 2026 [SC-WW], and
*United States*, October 2026 [SC-US]. These figures are browser viewport sizes, so they count
web traffic, not app installs.

Worldwide, October 2026, top reported resolutions:

| Resolution | Share |
| --- | --- |
| 414 × 896 | 12.67% |
| 360 × 800 | 8.57% |
| 384 × 832 | 7.24% |
| 390 × 844 | 5.33% |
| 393 × 873 | 4.43% |
| 360 × 780 | 3.31% |

Grouped by width, that is roughly 360 (≈11.9%), 384–393 (≈17%) and 414+ (≈12.7%).

- **360** is the narrowest width with large share, so it is the real floor for most layouts.
  If a layout works at 360, it works on almost every phone.
- **393** sits in the middle of the biggest cluster (384, 390, 393, 402).
- **430** brackets the large-phone cluster (412, 414, 428, 430, 440). Designing at the top of
  the range shows where content stretches too wide or leaves dead space.
- **414 × 896 is probably overcounted.** It is the single top entry in both the worldwide and
  US data (20.25% in the US), but it matches iPhones from 2018–2019. iOS 26 Safari turns on
  Advanced Fingerprinting Protection by default, which reports fixed screen values to sites
  [FP-9to5]. Treat the 414 bucket as "some iPhone", not as a real device width. The `large`
  preset still covers it.

## Extra check: 320 wide

WCAG 2.2 SC 1.4.10 Reflow requires content to work at 320 CSS px wide without horizontal
scrolling [WCAG-1.4.10]. That is also the width at 200% zoom on a 640-wide view and on small
older phones. Do a quick pass at 320 × 568 before you finish; you don't need a full design.

## Landscape

Don't design portrait-only. WCAG 2.2 SC 1.3.4 Orientation forbids locking to one orientation
unless it is essential [WCAG-1.3.4]. In landscape, a phone is wide (600+) but very short
(360–430), so:

- Android treats it as a compact-height window: width class medium (600–839 dp) or expanded
  (840+) [AND-WSC]. Consider a navigation rail in place of the bottom bar.
- iOS keeps the tab bar. Respect the side safe area on the camera side, and the smaller
  bottom inset for the home indicator.
- The keyboard can cover most of the height. Check that the focused field stays visible
  [NNG-INPUT].
