# IGNIS: fire realism and interface improvement plan

Planning audit: 2026-11-14. This document proposes the next implementation; application code, original habitat renders and prepared datasets have not been changed in this pass.

Implementation update: **model v2 is implemented** with the guided workflow, shared editor, shader effects and persistent scenario assistant. [VALIDATION.md](VALIDATION.md) records the shipped behavior, regression results, publication residuals and evidence limits. Exact property verification and independent predictive validation remain dependent on suitable measurements; a generative assistant provider is not connected.

## Recommended direction

Improve the physical model first, make the visual effects represent that model, and reorganize the interface around **Set up → Run → Respond → Review**. Keep the Moon, Mars and Gateway scenes, camera modes, equipment selection and original assets. Make **Ask IGNIS** accessible from every page and aware of the current scenario.

The target is a documented, testable reduced-order model with spatial transport approximations. A more convincing image must not imply greater predictive accuracy than the measurements support. Full reacting-flow CFD, certified detector performance and flight-hardware qualification are outside this implementation.

## 1. Audit completed

Reviewed the numerical engine, scenario-to-geometry mapping, runtime clock, effects, materials, ignition/sensor/agent presets, navigation, forecasting, assistant service and saved browser captures. Re-ran the existing unit suite: **73 tests passed**. Re-ran the workbook extraction check: **the Saffire-I extract matches its original workbook exactly**. These checks establish software/data integrity, not scientific validation.

### Parameter inventory

The 12 material profiles contain 178 source-tagged property entries:

| Current attribution | Entries | What the audit establishes |
| --- | ---: | --- |
| NASA publications | 34 | Includes observations, derived values, fitted coefficients and values transferred between specimen types. A NASA tag alone does not establish applicability. |
| Partial-gravity wire paper | 3 | Conditions and wire construction must accompany these entries. |
| Broad SFPE/Quintiere handbook entry | 63 | No edition/chapter/table/page is attached to individual values. Exact values are not independently verified. |
| Explicit model assumption | 78 | Remain assumptions until supported; do not relabel as measurements. |

All 12 solid specific heats are bare numbers without property-level provenance. All five ignition presets use assumed heat fluxes and durations. All five detector response constants lack individual calibration citations. Original PSI files and their extracted observations remain separate from these parameter choices.

### Concrete findings and required corrections

| Priority | Finding in the current implementation | Planned correction |
| --- | --- | --- |
| P0 | `exchange()` and `equalise()` move gas inventories without moving their energy. The connected zone temperature never receives the corresponding heat. | Exchange species and enthalpy together; solve pressure and temperature consistently from the updated state. |
| P0 | PMMA's CO₂ yield already accounts for its nominal carbon, then CO and soot are added independently. Water vapor, unburned vapor and char are not tracked. | Use a consistent reaction/product budget, including fuel-bound elements and retained/removed products. |
| P0 | Fuel consumption is capped by the entire room's oxygen inventory, rather than oxygen delivered to the flame. | Introduce a near-source control volume with advective and diffusive oxygen transport. |
| P0 | One U-shaped oxygen-limit curve, an 8 cm/s optimum and a common pressure slope are applied to all materials and configurations. | Use specimen-specific flammability envelopes. Gate interpolation by geometry, flow direction, pressure and oxygen coverage. |
| P0 | Ultem's 26.5% reference is recorded at 10.2 psia, while the common pressure correction treats reference limits as 14.7 psia. | Store each observation's reference pressure explicitly; do not normalize unrelated test definitions together. |
| P0 | The Saffire PMMA flame-length growth observation is used as a creeping spread coefficient. Flame envelope growth and a material's flame-front travel are different observables. | Track pyrolysis front, burned area, regression and visible flame length separately. |
| P0 | Pyrolysis smoke is called “smoldering,” even though a separate solid oxidation process is not solved. | Label heating/pyrolysis correctly; only model smoldering when suitable reaction and heat-release data exist. |
| P0 | Whole-cabin CO/soot changes are weighted directly by gravity; a common CO/CO₂ ratio is transferred to other fuels. | Use material- and ventilation-dependent yields with elemental constraints and documented applicability. |
| P0 | Mist extinguishes when an assumed cooling power exceeds a fixed fraction of HRR. Local gas-agent concentrations are auxiliary fractions disconnected from a spatial inventory. | Account for delivered agent, evaporation, heat transfer and local concentration through the same mass/energy system. |
| P0 | Battery runaway is a fixed 2.5 kW source for 45 seconds. It is not a cell thermal-runaway model. | Retain it as an explicitly prescribed illustrative heat source until cell-specific data are available; distinguish it from oxygen-limited secondary burning. |
| P1 | Flame shape is three translucent ellipsoids at 1.5× model size; blue/orange appearance is largely assigned by gravity. | Use a continuous flame envelope and emission/opacity fields driven by fuel, burning extent, flow, soot and HRR. Default to physical scale. |
| P1 | Smoke uses a separate real-time clock, 3× ventilation drift, fixed lifetimes and random constant velocities. A 60× run therefore shows transport inconsistent with its telemetry. | Use the solver's time, source rates and flow field for smoke, agent transport and detector exposure. |
| P1 | A random velocity at birth produces ballistic dispersion; it is not Brownian diffusion. SAME's gas-diffusion estimate is used for aerosol travel. | Separate gas diffusivity, particle Brownian motion, thermal expansion and unresolved mixing. |
| P1 | Rectangular room bounds and a single long-axis airflow direction stand in for supply/return paths and obstacles. | Add transport metadata and collision proxies alongside the existing scene, without editing meshes. |
| P1 | All detector rings change to alarm when any modeled sensor alarms; no detector location has its own exposure history. | Associate signals and alarms with individual detector positions and modeled response types. |
| P1 | UI compares instantaneous CO and CO₂ rise with time-based references. Initial CO₂ is zero. | Add baseline atmosphere and separate total concentration, fire-generated rise and duration-aware references. |
| P1 | “PTFE will not sustain a flame in any habitat atmosphere” and broad lunar-risk statements exceed the cited conditions. | Replace absolutes with scoped findings and explicit extrapolation labels. |
| P1 | Research, workflow tabs, scene controls and a long inspector compete for attention; labels can be 9–11 px. | Consolidate navigation, show one primary action per stage and disclose advanced information progressively. |
| P1 | The assistant is a scripted synthetic-record service inside `/firelab`; it cannot explain the active fire state. | Promote it globally and supply real scenario/evidence context, while accurately labeling its capabilities. |

### Reproduced conservation failures

Read-only diagnostic against the existing engine:

- Two connected 10 m³ zones, 21% O₂, initial 101.325 kPa and 22°C; set the first zone to 350 K. Disable combustion and ignition, set wall area to zero, use 0.1 m/s flow through 1 m² and advance 0.25 s. Total gas internal energy drops from **5,540,996.06 J to 5,500,944.47 J**: an unexplained **40,051.58 J / 0.723% loss**. Internal redistribution in this closed adiabatic setup must conserve total energy.
- Nominal PMMA is C₅H₈O₂, approximately 0.600 kg carbon/kg fuel using rounded atomic masses. At the current non-starved 0 g yields, CO₂ + CO + soot contain **0.657 kg carbon/kg fuel**, about **9.5% too much**. This follows directly from the current 2.2 kg/kg CO₂ yield, 0.04 CO/CO₂ molar ratio and 0.022 × 1.5 soot yield.

These become explicit regression tests during implementation. Existing green tests do not cover either invariant.

## 2. Scientific cross-check and source decisions

The cited observations below were checked against primary documents. Generalization to a habitat remains a separate modeling decision. Public source files must be kept unchanged; corrected parameter sets and extraction records should be versioned separately.

| Source checked | Supported finding and implementation consequence |
| --- | --- |
| [Saffire IV–V, ICES-2021-266](https://ntrs.nasa.gov/citations/20210011521), sections III.A and III.D | Fan shutdown did not guarantee prompt extinction; later airflow could revive burning. The 9.5 cm observation is flame length after 400 s on a particular PMMA slab. Preserve thermal history and distinguish flame length from spread. |
| [Saffire VI, ICES-2024-365](https://ntrs.nasa.gov/citations/20240002981), Tables 1–2 and Figures 4–7 | Provides atmosphere, geometry, HRR, gas rises and temperature observations. Uses approximately 13.1 MJ/kg O₂ for oxygen calorimetry. Peak and mean HRR, calorimetry methods, fan changes and time origins must remain distinct. |
| [BASS-II](https://ntrs.nasa.gov/citations/20160000593), slides 12–18 | PMMA film low/high-flow extinction, rod oxygen limits and slab flame appearance describe different configurations. Low-flow blue flames and transient sooty orange flames both occur in microgravity. Do not impose one shape, color or extinction threshold on every fuel. |
| [Olson et al., NASA/TM-2008-215260](https://ntrs.nasa.gov/citations/20080034883), Table 1 | The “up to four percentage points” result covers specified fuels and test conditions. Nomex, Ultem and Mylar results differ; it is not a common subtraction from every material's oxygen limit. |
| [White Sands parametric study](https://ntrs.nasa.gov/citations/20110008636), pressure discussion and tables | The reported −0.607 percentage points/psia is an average over a particular material/limit range. ULOI, MOC, thickness, igniter and pressure must accompany every observation. |
| [Konno et al., partial-gravity wires](https://discovery.ucl.ac.uk/id/eprint/10154634/), experimental section, Table 1 and Figures 2–5 | LDPE on Cu/NiCr cores, 1 atm, ≤21% O₂ and 60/150 mm/s opposed flow. Lunar/Martian intervals were 24/33 s. Core conductivity, melt behavior and orientation matter. These do not validate arbitrary cabin materials at 30–34% O₂. |
| [Ferkul et al., LPSC 2026](https://ntrs.nasa.gov/citations/20260001966) | Partial gravity can be more flammable under particular conditions. The discussed spread-rate maximum concerns downward spread, not a universal lunar multiplier. Treat lunar experiment concepts as planned configurations, not measured results. |
| [SAME-2](https://ntrs.nasa.gov/citations/20130000422), Table 1 and transport/detector discussion | The local table's particle diameters match the paper. Samples were heated below ignition. Its roughly 4 cm in 60 s discussion concerns gaseous transport and thermal expansion; it is not a universal aerosol diffusion coefficient. Detector performance needs size distribution and calibration. |
| [NASA-STD-6001B, Change 3](https://standards.nasa.gov/standard/NASA/NASA-STD-6001), sections 7.1 and 7.4 | Active version checked. The five-specimen, 15 cm and burning-debris criteria are test acceptance conditions, not continuous fire-spread equations or habitat safety predictions. |
| [ISS FDS overview](https://ntrs.nasa.gov/citations/20030053429), 2001 presentation | Supports the historical CO₂ bottle/discharge and power/ventilation isolation sequence. It does not establish the model's two-second automatic delay or current operational procedures. |
| [Fine water mist development](https://ntrs.nasa.gov/citations/20130011664), test standards and results | Reported extinction times belong to specified test configurations. They cannot justify fixed one-second extinction for every open fire or fixed efficiency for every rack. |
| [ACME/s-Flame](https://science.nasa.gov/biological-physical/investigations/s-flame/) | Spherical gaseous diffusion flames include sooty and soot-free fuels. Use as qualitative context, not as the default geometry or numerical calibration for burning solid panels. |
| [NIST CFAST technical reference](https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1889v1.pdf), chapters 2–5 | Supports control-volume conservation, coupled mass/enthalpy transport and documented plume/heat-transfer relations. Its terrestrial two-layer assumptions do not establish microgravity or partial-gravity accuracy. |
| [NIST: Generation and Transport of Smoke Components](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=861149), equations 5–7 | Supports particle settling and Stokes–Einstein diffusion with slip correction. Distinguish these from gas diffusion and turbulent dispersion. |
| [NASA-STD-3001 Volume 2, Revision F](https://standards.nasa.gov/standard/NASA/NASA-STD-3001_VOL_2), V2 6004 | Active July 2026 revision checked. The 3 mmHg CO₂ reference is a nominal one-hour average of total partial pressure. It is not an instantaneous emergency threshold or a limit on fire-generated rise alone. |
| [JSC 20584 Revision D](https://www.nasa.gov/wp-content/uploads/2026/02/jsc-20584-smacs-rev-d.pdf) | Current February 2026 SMAC source identified; duration and atmosphere applicability must accompany any CO reference. Use the primary standard rather than only the Saffire paper's secondary citation. |

The 63 handbook-tagged values are **not cross-verified numerical inputs** yet. Retrieve an exact primary measurement or identifiable handbook table for each; otherwise retain the value as a documented exploratory assumption. Grade, thickness, temperature dependence and test method matter. Do not silently substitute a nominal polymer's values for a particular aerospace product.

## 3. Proposed physical model

### 3.1 Provenance and applicability first

Extend each parameter beyond `{ value, source }` to include units, evidence class (measured, derived, calibrated, assumed), document location, specimen/grade, geometry, pressure, oxygen, gravity, flow direction and range, extraction method, and uncertainty where reported. Record “uncertainty not reported” rather than inventing a confidence interval.

Separate a measured property from a fitted coefficient even when both reference the same paper. Add an applicability check returning **within tested conditions**, **extrapolated**, or **insufficient data**. Retain the 12 materials, all original tables and old parameter versions. Begin quantitative comparisons with matched PMMA/SIBAL cases; other selections remain accessible with honest evidence status.

### 3.2 Ignition and fuel heating

Use an evolving surface energy balance, so changes in heating, cooling and ventilation do not retroactively change the entire thermal history:

\[
\rho_s c_s\delta\frac{dT_s}{dt}
=q''_{\rm absorbed}+q''_{\rm flame}
-h(T_s-T_g)-\epsilon\sigma(T_s^4-T_{\rm surroundings}^4)
-q''_{\rm conduction}-\dot m''_{\rm pyrolysis}L_g.
\]

This lumped form is only for a thermally thin, approximately uniform layer. Use a one-dimensional conduction solver through thick samples, with the same surface flux boundary. For the constant-flux, loss-free, semi-infinite benchmark, verify:

\[
t_{ig}=\frac{\pi k\rho_s c_s}{4}
\left(\frac{T_{ig}-T_0}{q''_{net}}\right)^2.
\]

This is a restricted analytical check, not a universal ignition law. Ignition also requires a suitable combustible mixture and ignition mechanism. “Reached an assumed temperature” alone is insufficient.

For overloads, use `P = I²R(T)` with documented conductor/contact geometry. For an arc, use deposited energy `E = η ∫V(t)I(t)dt`; keep deposition efficiency explicit. Preserve a prescribed heat-flux input for experiments that provide flux directly. Account for source-to-solid energy and direct source-to-gas energy without counting the same input twice.

Track the actual exposed fuel surface and remaining fuel/char. Separate heating, pyrolysis, flaming, cooling, extinction and burnout. Introduce true smoldering kinetics only for supported fuels. Reignition must follow retained heat, available vapor/oxygen and a credible ignition mechanism, not a fixed “hot for 120 seconds” timer.

### 3.3 Heat release, reaction products and gas energy

Use \(\dot Q_{chem}=\dot m_{burn}\Delta h_{c,eff}\). Keep chemical HRR separate from electrical/source heating and total thermal input. Maintain a local oxygen inventory supplied by transport. For appropriate fuels, \(\dot m_{O_2}\approx\dot Q_{chem}/(13.1\times10^6)\) is an oxygen-calorimetry approximation; do not treat it as exact chemistry for all fluorinated or composite materials.

For known fuel compositions, solve element balances with measured CO/soot/char yields. For PMMA, carbon must satisfy

\[
\frac{12}{44}y_{CO_2}+\frac{12}{28}y_{CO}+y_{soot}
+y_{char,C}+y_{unburned,C}=w_{C,fuel}.
\]

Oxygen and hydrogen balances must also include fuel-bound oxygen and water. Avoid independently imposing incompatible stoichiometry, heat of combustion and oxygen-consumption constants. Unknown product chemistry remains an explicit limitation; CO/CO₂ do not describe all hazards from every insulation or composite.

For each control volume, transport species and energy using the same fluxes:

\[
\frac{d(mY_i)}{dt}=\sum_{in}\dot mY_{i,in}-\sum_{out}\dot mY_i+\dot m_{i,reaction}+\dot m_{i,agent}-\dot m_{i,removed}
\]

\[
\frac{dU}{dt}=\dot Q_{gas}+\sum_{in}\dot m h_{in}-\sum_{out}\dot m h_{out}
-\dot Q_{wall}-\dot Q_{agent}-p\frac{dV}{dt}.
\]

Recover pressure from the mixture inventory and `pV = nRT`. Track wall temperature/thermal capacity instead of using the current fixed ambient wall sink. If layer volumes move, account for their pressure work. Cabin leakage, fresh supply, recirculation, filtration and CO₂ scrubbing are distinct processes.

### 3.4 Gravity, flow and spread

Use 0 g, 0.165 g and 0.38 g as the requested nominal regimes. Retain experimental acceleration histories/uncertainties for validation. Fuel orientation and flow direction must be explicit: opposed, concurrent and crossflow cannot share one scalar spread rule.

Use Richardson number as a regime indicator, \(Ri=g\beta\Delta T L/U^2\), with careful zero-flow handling. It identifies relative buoyancy and forced-flow importance; it is not itself a flame-speed law. Use Péclet number \(Pe=UL/D\) to distinguish advection from diffusion.

For applicable buoyant fires, use dimensionally consistent plume relations carrying actual density, temperature, gravity and convective HRR. A flame-height comparison can use

\[
Q^*=\frac{\dot Q}{\rho_\infty c_pT_\infty\sqrt{gD_f}\,D_f^2},
\qquad L_f/D_f\approx3.7(Q^*)^{2/5}-1.02.
\]

This is an empirical buoyant-fire correlation, evaluated only within a documented domain. It must never be evaluated at `g = 0` or extended toward zero gravity as a diverging flame length. Partial-gravity use remains an extrapolation until matched measurements support it.

At 0 g, solve transport and surface heating without buoyancy. A compact source may develop a rounded envelope; a panel or wire in ventilation develops a geometry-dependent envelope. Fit separate supported spread/extinction maps to matched BASS/Saffire/wire conditions. Unknown cases must not inherit an invented universal oxygen threshold.

### 3.5 Smoke, ventilation and detection

Start with a conservative finite-volume transport network: near-fuel volume, room mixing volumes, supply, return and connected compartments. Add a buoyant plume/upper-layer branch only when applicable. This is a spatial approximation, not a reconstruction of flight HVAC. Place transport nodes and obstacle proxies alongside existing room/equipment metadata.

The underlying transport relation is

\[
\partial_t(\rho Y_i)+\nabla\cdot(\rho\mathbf uY_i)
=\nabla\cdot(\rho D_{eff,i}\nabla Y_i)+S_i-L_i.
\]

Use conservative, positivity-preserving upwind fluxes with a transport stability bound. Recirculation moves contaminants; it does not introduce fresh oxygen unless a separate supply does. Pressure-driven leakage and fan shutdown have explicit boundary conditions.

Particle diffusion uses \(D_B=k_BT C_c/(3\pi\mu d_p)\); a stochastic tracer increment is \(\Delta\mathbf x=\mathbf u\Delta t+\sqrt{2D_B\Delta t}\boldsymbol\xi\), with a fresh independent normal draw per axis. Brownian diffusion can be much smaller than unresolved mixing. Label an assumed eddy diffusivity separately. Particle settling tends to zero with gravity; thermal expansion and molecular diffusion do not.

Smoke visuals sample the same transport state and mass inventory. Each detector samples its own location. A first-order instrument response, \(\tau\dot S+S=S_{local}\), requires a calibrated or explicitly assumed time constant, threshold, sensitivity and persistence rule. Do not use total flame radiation as calibrated UV/IR output; spectral sensitivity, field of view and occlusion matter. Preserve measured Saffire detector voltage as voltage until a calibration supports conversion.

### 3.6 Suppression and residual hazard

Keep power isolation, fan/valve isolation, CO₂, water mist and the existing chemical-agent option. Distinguish historical hardware evidence from current flight protocols.

For water mist, bound absorbed power by delivered/captured water and its thermal state:

\[
\dot Q_{water}=\dot m_{captured}\left[c_{p,w}(T_b(p)-T_w)+\chi_{evap}L_v(p)\right].
\]

Couple this to finite available heat, local vapor mass, deposition and fuel cooling; the expression is a capacity bound, not automatic evaporation or a guaranteed extinction time. CO₂ dilution must arise from delivered agent and mixing. Treat chemical inhibition as an empirical agent-specific relation until reaction data justify more detail. Power removal does not terminate a self-sustaining material fire or battery reaction.

Report flame-out, cooling and remaining smoke/gases separately. Extinction is not an all-clear state.

## 4. Visual implementation

- Replace nested spheres with a shader-based volume inside a lightweight proxy mesh. Sample a flame envelope based on burning surface, local flow, standoff and modeled extent. Use smooth opacity and restrained temporal variation; avoid a solid glowing blob.
- Drive luminosity from the chosen radiative fraction and soot/emission model. Treat screen RGB as an illustrative rendering, not measured flame temperature. A blue microgravity flame is one regime, not a rule.
- Default flame dimensions to 1× modeled size. Offer an explicit “Enhance visibility” option and scale indicator when enlargement helps an overview camera.
- Use smoke optical depth \(T=\exp[-\int\kappa_{ext}\rho_{smoke}\,ds]\), with documented optical assumptions, instead of fixed particle opacity. Preserve depth occlusion so effects do not appear through equipment and hulls.
- Keep fire-related light local and bounded. Preserve global lighting presets, exterior appearance and scene exposure. Add reversible burn/char overlays only to an identified fuel surface; no baked texture changes.
- Follow the same simulated time for flame fronts, smoke transport, agent release and sensor response. Pause freezes those processes; 1×/10×/60× produce the same state at the same simulated time. Reduce cosmetic high-frequency animation when it would alias or violate reduced-motion preferences.
- Show individual detector status and directional flow overlays on demand. Keep particles out of camera bounds and equipment raycasts. Use seeded visual randomness for reproducible captures.
- Start with the transport network above. A denser field solver is a later refinement only if measurements, accuracy needs and browser performance justify it.

## 5. Interface and assistant plan

### Navigation

Use four main entries: **Home · Fire simulation · NASA research · Results**. Retain existing URLs and route compatibility. `/firetwin` is the simulation workspace; `/predict` becomes its **Compare conditions** view. `/reports` becomes **Results**. Research retains studies, materials/measurements and an advanced coverage/gaps view.

Research can launch a scenario, but reading research is not a mandatory first step. The selected habitat, equipment, material, atmosphere and response setup travel together as one versioned scenario.

### Simulation workflow

| Stage | What the user sees and does |
| --- | --- |
| Set up | Pick Orbit/Moon/Mars, a room/equipment item, fuel and ignition source. Offer named example scenarios with a short explanation of what they demonstrate. Put atmospheric details, material properties and correlation settings under Advanced. |
| Run | One prominent **Start scenario** action. This starts heating; ignition can fail. Show elapsed simulated time, playback controls, phase and a compact telemetry strip. |
| Respond | Keep **Remove power**, **Isolate ventilation** and agent controls together beside detector status. Show expected mechanism and actual modeled result in plain language. |
| Review | Summarize ignition/alarm/flame-out times, peak HRR, gas history and remaining uncertainty. Compare an alternative gravity/ventilation/response case and export the exact scenario, model version, events and evidence. |

Use a single scenario editor shared by forecasting and the live scene. Keep room navigation and camera controls in a distinct **View** group. Show only the relevant controls for the current stage; retain access to the existing cutaway, floor, exploded and exterior modes.

Keep body text about 14 px and explanatory labels at least 12 px where practical. Use names such as **Fire power (HRR)**, **Airflow**, **Oxygen** and **Smoke at detector**, with units and short explanations. Use SI internally and consistent visible units, with CFM/psi conversions available. Separate baseline cabin values from live values and near-fire temperature from cabin average. Avoid showing a two-decimal oxygen-limit margin as a precise material guarantee.

Measured, modeled, assumed and extrapolated information should have a compact, consistent label with detail on demand. A nominal exposure reference must not be styled as an emergency alarm. Do not show a complete one-hour average before enough history exists unless the initial-history assumption is explicitly provided.

### Ask IGNIS

Add a persistent **Ask IGNIS** button with icon and text in the app header, plus a visible **Explain this run** action in the simulation. On desktop, open a dock beside the workspace; on mobile, use an accessible sheet above navigation. Preserve a clear view of essential controls and telemetry. Do not auto-open chat on every route.

Pass a bounded context snapshot containing scenario/version, current time and telemetry, events, selected material, applicable equations, parameter provenance, relevant NASA records and model limitations. Suggested prompts should include:

- “Why is the flame leaning this way?”
- “Why hasn't the smoke detector alarmed?”
- “What changes if I stop ventilation?”
- “Which NASA experiment supports this result?”
- “Which parts of this prediction are assumptions?”

Answers should start with a short explanation, link the supporting data/equation and offer a relevant comparison action. Computations come from the numerical engine. A proposed scenario edit is shown as a change the user can apply, rather than silently altering a running fire.

The existing bot is deterministic and synthetic. First replace its primary evidence context with the real source registry/data and active model state, retaining a clearly labeled demo mode for synthetic catalog questions. Use “scenario assistant” for that capability. A live generative model is a separate provider integration; making the button prominent does not make the current service an LLM. Any future live provider uses a server boundary and retrieved evidence, never invented measurements or client-side secrets.

## 6. Implementation sequence and file map

| Order | Work | Main locations | Completion gate |
| --- | --- | --- | --- |
| 1 | Versioned parameter provenance, scoped claims and standard references | `src/data/fire/`, `src/lib/fire/`, materials/data views | Every active coefficient is traceable or explicitly assumed; original datasets unchanged. |
| 2 | Conservative species/energy core, thermal fuel state and scoped spread models | Split `model.ts` into thermal, combustion, transport and response modules; retain the public runner/store contract | Closed-system conservation, finite fuel/oxygen, timestep convergence and matched-condition benchmark checks pass. |
| 3 | Shared transport/detector state and realistic effect layer | `scenario.ts`, transport metadata, `fire-effects.tsx`, `fire-sim-store.ts` | Visual and numerical clocks agree; effects respect walls, selections, pause and physical scale in all three habitats. |
| 4 | Guided simulation, navigation consolidation, results and assistant dock | `app-shell.tsx`, `section-tabs.tsx`, FireTwin panel/HUD, forecast, reports, `components/ai/`, assistant contracts/service | A first-time user can start, intervene, inspect evidence and review a run without finding hidden tabs. |
| 5 | Scientific evaluation, browser/performance testing and documentation | Fire tests, Playwright, benchmark/extraction tooling, `VALIDATION.md`, README | Report actual residuals and unsupported cases; preserve all original render/navigation checks. |

Keep the pure model API usable by both the forecast and live runtime. Move expensive comparisons to a worker if profiling requires it. Maintain one authoritative simulation clock. Follow the installed Next.js client/server guidance; the relevant local guide was reviewed in this planning pass.

## 7. Verification and acceptance criteria

1. **Conservation:** reaction budgets close for supported compositions; no negative fuel/species; no heat release without an accounted energy source. Adiabatic exchange conserves total energy, and internal transport conserves species mass. Test the two demonstrated defects explicitly.
2. **Numerics:** compare 0.25, 0.125 and 0.0625 s steps and respect transport stability constraints. Use proposed numerical tolerances of <1% change for integrated outputs away from ignition/extinction boundaries, with event timing resolved separately. These are software acceptance targets, not experimental uncertainty.
3. **Regime behavior:** zero buoyancy at 0 g; diffusion/expansion remain. Match BASS low-flow/high-flow outcomes only within corresponding configurations. Do not assert that every fuel burns fastest on the Moon or that every fan shutdown extinguishes a fire.
4. **Scientific comparison:** separate calibration runs from held-out runs. Compare complete histories when timing/flow information exists, and separately report peak/mean HRR, integrated heat, fuel loss, O₂, CO/CO₂ and detector observables. Retain inconsistent publication quantities with their methods/notes. Do not score uncalibrated voltages as concentrations.
5. **Evidence coverage:** preserve the PSI originals and extraction checks. Show unsupported chemistry, atmosphere or material combinations as extrapolations/insufficient data. Report sensitivity ranges as sensitivity, not statistical confidence.
6. **Visual agreement:** at the same simulated timestamp, flame footprint, transport, alarms and agent dose agree across playback speeds and forecast/live modes. No opaque flame ellipsoids, compulsory 1.5× enlargement or universal blue-at-zero-g rule.
7. **Scene preservation:** original habitat modules and `public/models` retain their hashes. Existing room/equipment raycasts, Gateway module framing, floors, cutaways and exterior modes continue to work. Add only detachable effect and transport metadata layers.
8. **Usability/accessibility:** keyboard navigation, readable units, clear current stage, one primary action, no obscured controls, persistent assistant access and accurate citation links. Test desktop and narrow mobile layouts, reduced motion and no-WebGL fallback.
9. **Performance:** profile the actual device/browser, recording frame time, memory and simulation step throughput. Target 60 fps on desktop and at least 30 fps on the tested mobile tier; scale visual quality without changing physics. Record measured results rather than assuming those targets were achieved.

## 8. Remaining evidence needs

Public data retrieval continues as part of implementation; no additional user dataset is required to begin. The remaining gaps are exact thermophysical-property sources, synchronized Saffire HRR/O₂/flow histories, specimen-specific BASS spread/extinction records, detector transfer functions, representative habitat HVAC/thermal properties and suppression delivery/capture measurements. The current Saffire-I workbook supplies useful observed sensor channels, but not all of these quantities.

Reconstruct experimental conditions before fitting. If a figure must be digitized, retain the image, axes, digitization method and uncertainty and label the values as digitized. Where suitable evidence cannot be recovered, keep the feature exploratory and expose the limitation. Passing software tests or matching a calibrated peak must never be reported as independent scientific validation.
