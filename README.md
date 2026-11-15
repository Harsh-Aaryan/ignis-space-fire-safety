# IGNIS

Fire safety research for crewed spaceflight. A NASA Space Apps Challenge 2026 entry for [Flame in Freefall](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/).

IGNIS does two things. It indexes NASA's fire-safety investigations by the questions the challenge asks of them, and it runs a physics model of a fire inside a Moon, Mars or orbital habitat so the evidence can be seen at work. It does not certify materials, hardware or procedures.

## How it answers the challenge

| The challenge asks for | Where it is in IGNIS |
| --- | --- |
| Investigations most relevant to fire safety in crew environments: spacecraft, stations, lunar and Martian bases, pressurized rovers | **Research → Investigations.** 19 records, each marked for every crew environment as tested there, applying there, or transferable with a stated caveat. |
| Data that supports predictive modeling of flammability and fire scenarios | **Research → Modeling data.** Eight NASA PSI experiment tables with checksums, the Saffire I sensor history, 12 material profiles with a source for every property, four Saffire reference burns, and the model compared against them. |
| Research that informs next-generation controls, detection and suppression | **Research → Detection and suppression.** What each record tells a designer, the detectors and extinguishers represented in the simulation, and what has not been tested. |

**Research → Evidence gaps** shows what has been tested at each gravity level and compares the cabin you have set with the conditions each experiment actually covered. **Simulation** runs the fire. **Results** exports it.

## What is real and what is modeled

- **The research index is real.** Every statement in `src/data/research/investigations.ts` comes from a NASA PSI record, an NTRS citation or a document in the source registry (`src/data/fire/sources.ts`), all held in this repository. Tested-condition ranges are computed from the bundled NASA tables. There is no generated or illustrative research data in the site.
- **The NASA tables are unmodified.** `public/data/nasa-psi/` holds the original CSVs and metadata for BASS, BASS-II, FLEX, Saffire I–III, SAME and SAME-R with DOI, version, license and SHA-256. `scripts/fetch-nasa-psi.ps1` retrieves them; `python scripts/prepare-saffire-telemetry.py --check` verifies the Saffire I extract against the workbook.
- **The fire model is a reduced-order model, not a validated predictor.** Every material property carries one of four evidence classes (measured, derived, calibrated, assumed). Model output for conditions no experiment matches is marked extrapolated, which includes everything at lunar and Martian gravity.
- **The model underpredicts the Saffire burns** and says so on the Model check view. See [VALIDATION.md](VALIDATION.md) for the comparison, the closures the model uses and what it does not resolve.
- **The habitats are conceptual.** Geometry follows published concepts (Foster + Partners / ESA lunar habitat, AI SpaceFactory MARSHA, NASA Gateway exterior). It is not flight hardware.

## The fire model

`src/lib/fire/` holds a three-zone compartment model: the fuel's neighborhood, the room and the rest of the habitat.

- `thermal.ts`: one-dimensional conduction into thick fuels, a lumped layer for films and edges, with surface convection and radiation.
- `chemistry.ts`: carbon, hydrogen and oxygen balances for acrylic, cellulose and polyethylene.
- `transport.ts`: species and energy exchanged together between zones; ideal-gas pressure; particle diffusion with slip correction.
- `model.ts`: ignition, burning rate, flame feedback, the flammability envelope against flow speed, detection and suppression.

Gravity enters through buoyant flow, which is zero in orbit and about 11 cm/s at lunar gravity. Whether a flame persists is decided by a flammability envelope built on BASS-II and Saffire results; how fast it burns is calibrated to Saffire VI.

Flaming chemistry is resolved for four profiles (`pmma`, `sibal`, `paper`, `ldpe-wire`). The other eight heat and release vapor only.

## Run it

```bash
npm install
npm run dev
```

Checks:

```bash
npm test            # unit tests (vitest)
npm run build       # production build
npm start           # serve the build on port 3000
npm run test:e2e    # browser tests against a running server (Playwright, installed Microsoft Edge)
```

Set `IGNIS_TEST_URL` to point the browser tests at another address. They run with software WebGL, so the three habitat fire tests take a minute or two each.

`node scripts/audit-fire-model.cjs` writes a numerical report of the model to `.qa-baseline/` without changing any source data.

## Ask IGNIS

A scenario assistant available from every page. Without configuration it explains the current run from the model state and the source registry. With `GROQ_API_KEY` set on the server it adds generated answers restricted to the retrieved source extracts; anything that fails validation falls back to the local explanation.

Short requests such as “explain”, “what happened?” and “explain my scenario” refer to the current run. Run summaries use the captured phase, heat output, peak, ignition and extinction times, smoke and alarm readings directly. Short follow-ups use the previous question for context. Generated research explanations use short paragraphs, and the full model metadata is available under “Run context”.

Copy `.env.example` to `.env.local` for local use. On Netlify, add `GROQ_API_KEY` in the project's environment variables with the Functions scope. Never prefix it with `NEXT_PUBLIC_`. `IGNIS_CHAT_PROVIDER=local` disables external calls.

The endpoint (`src/app/api/ask-ignis/route.ts`) bounds input and output size, checks the request origin and limits requests to ten per minute per address within one server instance. Citations identify the source extracts used; they are not independent verification.

## Layout

```
src/app/                        routes: /, /simulation, /simulation/compare, /research (+ /data, /controls, /gaps, /[id]), /results
src/components/design/          shared page furniture (kit.tsx) and section tabs
src/components/simulation/      habitat viewport, view toolbar, telemetry strip, scenario and equipment panels
src/components/research/        investigations, record detail, modeling data, controls, evidence gaps
src/components/three/           the 3D habitats and fire effects
src/data/research/              the research index
src/data/fire/                  materials, heat sources, sensors, suppression actions, source registry
src/data/verified/              NTRS citation records
src/lib/fire/                   the fire model and its tests
src/lib/research/               filters, gravity coverage, cabin-versus-tested comparison, exports
src/stores/                     cabin scenario and selection; the running simulation
public/data/nasa-psi/           original NASA PSI tables, metadata, manifest
```

Earlier addresses (`/firetwin`, `/predict`, `/materials`, `/gravity-bridge`, `/firelab`, `/reports`) redirect to their new sections.

Built with Next.js (App Router), TypeScript, Tailwind CSS, React Three Fiber and Zustand. Design tokens live in `src/app/globals.css`. Asset licenses are in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

## Deployment

`netlify.toml` builds with `next build` on Node 22 and publishes `.next`. Saved cabin scenarios stay in the browser's local storage; nothing is uploaded.

## Limits

- No cabin-scale fire, smoke detection or suppression test at lunar or Martian gravity is indexed. The partial-gravity flammability tests that are indexed last seconds. The model's partial-gravity results are extrapolations.
- The model is not CFD. It does not resolve a flow field, lithium-ion cell chemistry, acid gases from fluorinated or silicone materials, or deflagration.
- Gas readouts are instantaneous. Exposure limits are averages over an hour or a day and are not computed.
- Detector thresholds, response times and extinguisher capture are assumed, not calibrated to flight hardware.
- The research index covers what this project holds and has checked, not all fire-safety research.
