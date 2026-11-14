# Overview habitat previews

These JPEGs are browser captures of the existing FireTwin scenes, used only by the Overview page. They do not instantiate a second renderer.

- Moon: exterior view; Foster + Partners / ESA-inspired conceptual habitat.
- Mars: exterior view; AI SpaceFactory MARSHA-inspired conceptual habitat.
- Gateway: NASA-derived exterior; its interior layouts elsewhere in the app are conceptual.

Captured locally on 2026-11-13. Recreate with `node scripts/capture-overview-previews.cjs` while the app is running on port 3000, or set `IGNIS_SCREENSHOT_URL` to the local server origin. The capture uses a fresh browser session and does not alter the user's saved scenarios.

Pass habitat names (for example, `moon mars`) to regenerate only those previews.
