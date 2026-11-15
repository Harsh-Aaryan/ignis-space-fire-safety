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
- **Accuracy varies by quantity and test.** The Model check view reports in-sample and held-out errors, including failures. The VI-3 reproduction follows NASA's published fan timeline; VI-4's airflow history is incomplete. See [VALIDATION.md](VALIDATION.md) for current errors, calibration and limits.
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

An assistant available from every page. It answers two kinds of question: what happened in the current run, and what the research says. Without configuration it answers from the model state, the research index, the source registry and the NASA PSI corpus. With `GROQ_API_KEY` set on the server it adds generated answers restricted to the retrieved records, passages and source extracts; anything that fails validation falls back to the local answer.

Research questions need no run. “Which NASA investigations are most relevant to lunar-habitat fire detection?”, “What is known about smoke particle size in microgravity?”, “Compare FLEX and FLEX-2” and “Which fire conditions have not been tested at Martian gravity?” are answered with the closest records from the research index (each linked to its page, with the reason it ranked and the evidence IGNIS holds for it), findings quoted from those records, matching NASA PSI investigation records, and an explicit list of conditions no indexed test covers, together with the transfer caveats the records state. Ranking uses `src/lib/research/rank.ts`; gaps come from the gravity coverage matrix in `src/lib/research/coverage.ts`. When a question names a subject the index never mentions, the answer says so instead of offering loosely related records.

Short requests such as “explain”, “what happened?” and “explain my scenario” refer to the current run. Run summaries use the captured phase, heat output, peak, ignition and extinction times, smoke and alarm readings directly. Without a run, these questions get a short pointer to set one up and examples of research questions. Short follow-ups use the previous question for context. Generated explanations use short paragraphs, and the full model metadata is available under “Run context”.

### Retrieval corpus

`src/data/rag/psi-combustion-corpus.json` holds the 24 investigations filed under Research Area “combustion science” in the NASA Physical Sciences Informatics repository: record metadata, objective, hypothesis, approach and research impacts as plain text, publication titles and DOIs, public data-file counts and passages of about 120–220 words. Contact details are not stored; investigator names are limited to principal investigators. `src/lib/rag` searches it together with the research index and the source registry using BM25 with light stemming; it has no dependencies and no model download.

```bash
python scripts/NASAflamesRAG.py build                 # refetch from the PSI API and rewrite the corpus
python scripts/NASAflamesRAG.py check                 # validate schema, privacy rules and size
python scripts/NASAflamesRAG.py query "cool flame droplet extinction" -k 5
```

`query` prints the best passages with accession and record link, and an extractive answer. With `GROQ_API_KEY` set it also asks Groq for an answer restricted to those passages and rejects citations outside them (`--extractive` skips the call). The script needs Python 3.10 or later and `requests`.

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
