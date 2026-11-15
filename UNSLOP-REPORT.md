# IGNIS interface polish

Applied [Unslop](https://github.com/heydamir/unslop/tree/main/skills/unslop) by [Damir Sokolovsky (@heydamir)](https://x.com/heydamir), CC BY 4.0, in polish mode. The existing global installation at `C:\Users\Harsh\.codex\skills\unslop` matches the upstream skill downloaded with the official skill installer, including its references and scripts.

## Audit

- Overview and page eyebrows used 11px condensed uppercase labels with wide tracking
- Habitat hotspot labels used 10px uppercase text
- Small metadata had low contrast on raised card surfaces
- Controls and cards shared almost identical 2–4px corners
- Navigation, panels, filters, and simulation controls used inconsistent spacing and sizes
- Record categories and supporting labels competed with the primary action through repeated accent color
- The long overview introduction delayed the habitat preview on mobile
- Cabin conditions truncated the airflow readout on narrow screens
- Buttons, tabs, switches, and camera toggles used broad transitions; the camera toggle animated its position
- Home and End selected habitats without moving keyboard focus to the selected radio

The existing palette, IBM Plex typefaces, real habitat previews, scientific content, and section order supplied a strong direction for a focused polish pass.

## Direction

- **Product:** Fire-safety evidence and habitat simulation for spaceflight research
- **Character:** Precise, restrained, readable
- **World:** Research instruments and spacecraft cabins
- **Moments:** The existing habitat renders and measured data
- **Signature:** Ember marks for active selections and primary actions

## Nine passes

| Pass | Result |
| --- | --- |
| Spacing | Shared panel padding follows 24px, environment controls use 16px, navigation rows use 36px, and primary touch controls use 44px. |
| Color | Kept the graphite and ember palette. Raised tertiary text to `#96918A`; supporting eyebrows and record categories use neutral text. Ask IGNIS now uses the same accent fill and text color as Run a fire scenario. Semantic evidence colors retain their meanings. |
| Icons | Lucide icons share a 1.5px stroke. Shared navigation and text-link icons use 16px; the assistant action has a neutral icon. |
| Copy | Shortened the introduction while preserving its subject and scope. Removed the headline's trailing period, shortened the search placeholder, and corrected the findings caption to describe sourced findings rather than verbatim quotations. |
| Type | Kept IBM Plex Sans and Mono. Removed the condensed and italic font downloads; page labels use 12px sentence case, page titles use 28–32px, and the overview title uses 36–44px. |
| Layout | The habitat render fills the overview hero on desktop and mobile. The heading, description, and actions are centered directly over the image. The three landing statistics (19 indexed records, 10 flight experiments, and 2 partial-gravity test records) were removed at the user's request. Simulation telemetry spans beneath both the viewport and side panel, with four readouts on each side of a centered graph. Narrow layouts wrap into rows without horizontal scrolling. |
| Details | Tags use 4px corners, controls 8px, and cards 12px. Research records and table rows have clearer keyboard states. Home, End, and arrow keys keep focus on the selected habitat. |
| Visuals | Retained the project's actual Moon, Mars, and Gateway renders as full-bleed hero backgrounds. A vertical shade keeps the centered text readable over the render. The live heat-release and oxygen graph remains in the center of the simulation bar, including a stable empty state before a run. |
| Motion | Buttons, tabs, switches, and camera controls name their transition properties. The camera toggle moves with a transform; interaction timing uses a shared 150ms duration and easing curve. Reduced-motion support remains in place. |

## Local verification

- `npm test`: 151 tests passed across 15 files
- `npm run build`: passed compilation, TypeScript checks, and generation of 33 pages
- Responsive checks passed at 320, 390, 768, 1024, and 1600px; all four cabin values fit without clipping
- Research, modeling data, detection and suppression, evidence gaps, gravity comparison, and results load at 390 and 1600px without page overflow or uncaught JavaScript errors
- Habitat arrow keys, Home, End, visible focus, the cabin popover, and Escape passed interaction checks
- Text contrast: captions on cards 5.15:1, primary action text 6.47:1, and links on cards 7.96:1
- New layout regressions passed at 320, 390, 1024, 1280, 1600, and 1920px: all eight telemetry readouts fit, the graph remains centered within 1px, the desktop simulation retains at least 300px of viewport height, and telemetry stays docked at the bottom
- The overview render fills the workspace, and Ask IGNIS matches the primary action's computed fill and text colors
- Live 3D capture at 1600px: telemetry width 1360px, scroll width 1360px, graph center within 0.5px of the bar's center, and no uncaught JavaScript errors
- `npm run test:e2e` with `IGNIS_TEST_URL` set to `http://127.0.0.1:3001`: all 22 tests passed against the production build in Microsoft Edge (6.4 minutes), including the complete Moon, Mars, and Gateway fire lifecycles, conversational run explanations, and layout regressions
- The existing development preview at `http://localhost:3000` returns HTTP 200 and serves the updated overview
- `git diff --check`: passed
- Landing overlay revision: production build and all 9 site browser checks passed, including centered text over the image and removal of the statistics row; desktop and mobile captures were visually reviewed
- Final build smoke checks passed again for the assistant (including “didn’t” follow-ups) and hero after the contraction-normalization update

## Assistant and render update

Ask IGNIS understands requests such as “explain”, “explain my scenario”, “what happened?”, and “explain what this run did and how it worked”. Short follow-ups use the previous question. Run summaries are assembled from the captured phase, heat output, peak, ignition and extinction times, smoke, and alarm readings. Missing values stay unknown. The original model metadata is available under the expandable Run context below each answer.

Broader research answers continue through the configured Groq provider, with instructions for short paragraphs, plain language, and a clear distinction between published experiments and this run. Provider request and response validation are covered with mocked completions; run-summary browser tests exercise the real local API.

The desktop hero fills the first screen beneath the navigation, with a 760px minimum height; mobile uses a 720px minimum. All three habitat stills were recaptured at 3120 × 2222px using the existing high-tier 3D renderer and native 1.5 DPR, replacing the 1160 × 822px captures. Next Image serves them at quality 90. The capture helper releases its browser and graphics buffers between habitats. See [the preview README](public/overview/README.md) for reproduction.

Before and after captures are saved locally under `.qa-baseline/unslop/`, which is ignored by Git. The captures include the desktop overview, mobile overview, and desktop research index. The responsive check also records its results there.

| Screen | Before | After |
| --- | --- | --- |
| Desktop overview | [Before](.qa-baseline/unslop/before/overview-desktop.png) | [After](.qa-baseline/unslop/conversational-hero/overview-desktop.png) |
| Mobile overview | [Before](.qa-baseline/unslop/before/overview-mobile.png) | [After](.qa-baseline/unslop/conversational-hero/overview-mobile.png) |
| Research index | [Before](.qa-baseline/unslop/before/research-desktop.png) | [After](.qa-baseline/unslop/wide-layout/research-desktop.png) |

Simulation captures: [Desktop](.qa-baseline/unslop/wide-layout/simulation-desktop.png), [mobile](.qa-baseline/unslop/wide-layout/simulation-mobile.png).

The scientific model, source datasets, and research records retain their existing behavior and contents.
