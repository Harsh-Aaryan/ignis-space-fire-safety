# Overview habitat previews

These JPEGs are browser captures of the existing FireTwin scenes, used only by the Overview page. They do not instantiate a second renderer.

- Moon: exterior view; Foster + Partners / ESA-inspired conceptual habitat.
- Mars: exterior view; AI SpaceFactory MARSHA-inspired conceptual habitat.
- Gateway: NASA-derived exterior; its interior layouts elsewhere in the app are conceptual.

Recaptured locally at 3120 × 2222 pixels using the high-tier renderer at its native 1.5 pixel ratio and JPEG quality 96. The landing page serves these through Next Image at quality 90, with responsive sizes. Recreate with `node scripts/capture-overview-previews.cjs` while the app is running on port 3000, or set `IGNIS_SCREENSHOT_URL` to the local server origin. Each habitat uses a fresh browser session to release graphics buffers and does not alter the user's saved scenarios.

Pass habitat names (for example, `moon mars`) to regenerate only those previews.
