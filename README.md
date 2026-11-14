Intelligent Grounded Navigation of Investigation Science: a NASA Space Apps Challenge 2026 "Flame in Freefall" interactive mockup. All data is synthetic.

The generated catalog, rankings, and recommendations are synthetic. A separate index of public NTRS citation metadata, retrieved 2026-11-12, is labeled verified and contains no extracted measurements. No DOI was invented. PSI dataset files were not downloaded.

# IGNIS

Intelligent Grounded Navigation of Investigation Science.

Phase 1 prototype for the NASA Space Apps Challenge 2026 challenge [Flame in Freefall](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/).

Tagline: from NASA combustion research to mission-ready fire safety insights.

IGNIS is a mission-control console for asking what existing combustion evidence can and cannot say about a habitat scenario. It is not a fire simulator and it does not estimate safety.

**Prototype — Synthetic Demonstration Data.** Every synthetic run identifier, measurement, chart, ranking, coverage figure, and recommendation is generated for the demonstration. Public investigation family names on those rows are categories, not citations. Verified rows are NTRS metadata only; their abstracts were not parsed into numbers.

## What you can do

One scenario drives every module.

1. **Mission Overview** — Moon, Mars, or the Gateway-inspired lunar-orbit habitat. Oxygen, total cabin pressure, airflow, and material carry across a switch. Gravity follows the habitat: Moon 0.165 g, Mars 0.38 g, Gateway and ISS ~0 g, Earth 1 g. pO₂ is oxygen fraction times total cabin pressure. ISS and Earth are comparison regimes, not extra FireTwin scenes.
2. **FireTwin** — orbit a stylized habitat or rover, hover and click equipment, fly the camera to a module, reset the view, and toggle cutaway or exploded layout. Evidence mode and scenario mode share the selection. If WebGL is missing, a plan view keeps the same hotspots.
3. **Research Explorer** — search, filter, sort, and page 20 synthetic dossiers and 100 fictional runs. Compare up to three dossiers. Adjust the ranking weights. Missing measurements are excluded or labeled, not treated as zeros.
4. **GravityBridge** — heatmap, nearest rows, out-of-range warnings, and gaps computed from the catalog. An empty lunar or Martian cell means that gravity was not tested here. It is not a negative result and not a safety claim. An optional oxygen sketch withholds any partial-gravity blend.
5. **FireLab** — deterministic proposals ranked from those gaps, plus a demo briefing clerk that answers from the same records. No external model is called.
6. **Reports** — print to PDF from the browser, export CSV, and save, load, import, or export scenarios in this browser.

Three journeys are wired through: lunar material flammability, microgravity smoke detection, and Martian habitat gaps.

## Relevance, coverage, and priority

These are heuristics over the synthetic catalog. They are not ignition probabilities, hazard percentages, or certifications.

- Relevance weights, before renormalizing around unreported fields: objective and fuel 30%, oxygen and pressure 25%, gravity and airflow 20%, measurement availability 15%, evidence completeness 10%. Cross-regime gravity is deliberately not treated as almost the same g.
- Envelope coverage mixes gravity, oxygen, pressure, airflow, and required measurements for the objective. Each term is capped. The interface states that this is not a fire-safety probability.
- Gap severity uses explicit count thresholds. Recommendations then score gap size, mission relevance, usefulness, related dossiers, and a rough feasibility note.

## Stack

Next.js (App Router) and TypeScript, Tailwind CSS, shadcn/ui, React Three Fiber, Drei, Three.js, Motion, Recharts, Lucide, Zustand.

The visual system is Ember Instrument: graphite elevations, bone type, one copper accent, IBM Plex Sans / Condensed / Mono, and aerospace status chips. Tokens live in `src/app/globals.css`. `src/design/palette.ts` holds the matching fallbacks for the 3D scene. Do not hardcode a second palette in components.

The lunar surface in FireTwin uses a procedural stand-in for the CC0 Poly Haven Moon 01 tile (3.1 m repeat) so the build does not depend on a texture CDN. MLI, aluminium, and pad colours follow that same material table.

CC0 environment and ground maps live in `public/textures/cc0/`. Sources and licences are in `ATTRIBUTIONS.md`. They are loaded from this site, not from a texture CDN.

## Local setup

```bash
npm install
npm run dev
```

Open the URL printed by Next.js. Production check:

```bash
npm test
npm run build
npm start
```

Copy `.env.example` to `.env.local` only if you need to pin the Phase 1 switches:

```
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_ASSISTANT_PROVIDER=mock
```

Any other data source or assistant provider throws, on purpose, until Phase 2 exists. Do not put API keys in the client bundle.

## Architecture

```
src/app/                  routes
src/components/           shell, modules, charts, 3D
src/data/mock/            synthetic catalog (only the services import this)
src/data/missions.ts      mission profiles and the three journeys
src/lib/ranking/          explainable relevance
src/lib/analytics/        coverage, heatmap, gaps, applicability
src/lib/evidence/         filters and the shared analysis
src/services/             repository, assistant, and scenario storage contracts
src/stores/mission-store.ts
src/design/palette.ts
```

UI code calls `getServices()` and `analyzeMission()`. It does not import fixture rows directly. `EvidenceRepository`, `ResearchAssistant`, and `ScenarioRepository` are the swap points for later NASA PSI records, a database, and a retrieval-augmented model.

Saved scenarios use `localStorage`. The live scenario, weights, filters, activity, and chat use `sessionStorage`.

## Tests

`npm test` covers relevance scoring, missing-value handling, weight renormalization, catalog integrity (no DOIs, fictional run ids, no lunar or Martian rows), coverage, heatmap counts, gap discovery, recommendation ranking, and the demo assistant.

## Deployment

`netlify.toml` builds with `next build` and publishes `.next`, with Node 22. Netlify’s Next.js runtime picks up the App Router from that output. The site can be public for review while the GitHub repository stays private.

This environment does not ship Netlify credentials. After the private repository exists, connect it in Netlify and use the build settings already in `netlify.toml`. Confirm `NEXT_PUBLIC_DATA_SOURCE=mock` and do not add an LLM key for Phase 1.

## Phase 2

Replace the mock repository with NASA PSI investigation records and verified measurements. Add real citations and DOIs only when they belong to those records. Keep the same TypeScript shapes (`Investigation`, `ExperimentalRun`, and the rest) so the pages do not need to be rewritten.

A database such as Postgres can sit behind `EvidenceRepositoryAsync`. A later assistant can implement `LlmResearchAssistant` with retrieval over the verified corpus. Do that only with an explicit provider setting and a server-side key. Predictive fits stay labeled as illustrations until a validated model exists. Partial-gravity behavior should not be interpolated from microgravity and Earth data and then presented as a result.

## Scientific limits of this prototype

- The catalog has microgravity and Earth rows only. Lunar (0.165 g) and Martian (0.38 g) cells are empty by construction.
- Spread, soot, particle, and detector numbers follow a small deterministic generator so the console is internally consistent. They are not instrument data.
- The 3D habitat is built from primitives. It is a navigation model, not a geometric twin of flight hardware.
- The flame sketch compares appearance only. It does not propagate a flame.
- Rankings can look precise. The precision is the math of the heuristic, not the precision of an experiment.
