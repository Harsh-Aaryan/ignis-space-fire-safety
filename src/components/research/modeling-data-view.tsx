"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import {
  ActionLink,
  EvidenceTag,
  ExternalLink,
  Note,
  Panel,
  Stat,
  Tag,
  TextLink,
  actionClass,
  evidenceHint,
  table,
  type EvidenceClass,
} from "@/components/design/kit";
import { Cite, CitedValue } from "@/components/fire/cite";
import { fieldClass } from "@/components/research/index-filter-bar";
import { CfastCrosscheck } from "@/components/research/cfast-crosscheck";
import { PsiDatasets } from "@/components/research/psi-datasets";
import { SaffireDetection } from "@/components/research/saffire-detection";
import { FIRE_MATERIALS, materialById, type FireMaterial } from "@/data/fire/materials";
import { SAFFIRE_BENCHMARKS, SAME2_TABLE, WSTF_LIMITS, peakHrrAnalyses } from "@/data/fire/options";
import { closureParameterRecords, materialParameterRecords } from "@/data/fire/parameters";
import { FIRE_MODEL_VERSION, FIRE_SOURCES, RETRIEVED_AT, type Cited } from "@/data/fire/sources";
import { RESEARCH_INDEX_SUMMARY, investigationsForPillar } from "@/data/research/investigations";
import { ACCURACY_SUMMARY, EVALUATION_SNAPSHOT, cfastTemperatureGap, peakHrrRangeStatus } from "@/lib/fire/accuracy";
import { reactionYields } from "@/lib/fire/chemistry";
import { downloadText } from "@/lib/research/export";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useFireSimStore } from "@/stores/fire-sim-store";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "tables", label: "NASA experiment tables" },
  { id: "materials", label: "Material properties" },
  { id: "measurements", label: "Flammability and smoke" },
  { id: "check", label: "Model check" },
  { id: "sources", label: "Sources" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

const EVIDENCE_ORDER: EvidenceClass[] = ["measured", "derived", "calibrated", "assumed"];

const SOURCE_KIND_LABEL = { nasa: "NASA", "peer-reviewed": "Peer-reviewed", handbook: "Reference", assumption: "Assumption" } as const;

function isView(value: string | null): value is ViewId {
  return VIEWS.some((view) => view.id === value);
}

/** Every cited property across the material profiles. */
function citedEntries(material: FireMaterial): Cited<unknown>[] {
  return Object.values(material).filter((value): value is Cited<unknown> => Boolean(value) && typeof value === "object" && "source" in (value as object));
}

/** Reads the view and table from the URL. Render inside a Suspense boundary. */
export function ModelingDataFromQuery() {
  const params = useSearchParams();
  const view = params.get("view");
  const tableId = params.get("table");
  return <ModelingDataView key={params.toString()} initialView={isView(view) ? view : tableId ? "tables" : "overview"} initialTable={tableId ?? undefined} />;
}

/** Modeling data: what a fire model can be built on and checked against. */
export function ModelingDataView({ initialView = "overview", initialTable }: { initialView?: ViewId; initialTable?: string }) {
  const [view, setView] = useState<ViewId>(initialView);

  function show(next: ViewId) {
    setView(next);
    window.history.replaceState(null, "", next === "overview" ? window.location.pathname : `${window.location.pathname}?view=${next}`);
  }

  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="Modeling data views" className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            onClick={() => show(item.id)}
            className={cn(
              "min-h-10 shrink-0 rounded-md border px-3 text-sm transition-colors",
              view === item.id ? "border-primary bg-elev-2 text-foreground" : "border-border-subtle text-muted-foreground hover:bg-elev-2 hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "overview" ? <Overview onShow={show} /> : null}
      {view === "tables" ? <PsiDatasets initialId={initialTable} /> : null}
      {view === "materials" ? <MaterialProperties /> : null}
      {view === "measurements" ? <Measurements /> : null}
      {view === "check" ? <ModelCheck /> : null}
      {view === "sources" ? <Sources /> : null}
    </div>
  );
}

function Overview({ onShow }: { onShow: (view: ViewId) => void }) {
  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const entry of FIRE_MATERIALS.flatMap(citedEntries)) tally[entry.evidence ?? "assumed"] = (tally[entry.evidence ?? "assumed"] ?? 0) + 1;
    return tally;
  }, []);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const records = investigationsForPillar("predictive-modeling");

  return (
    <div className="flex flex-col gap-5">
      <Panel title="What is held here">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <Stat label="NASA experiment tables" value={RESEARCH_INDEX_SUMMARY.psiTables} note="Original files with checksums" />
          <Stat label="Saffire I sensor readings" value="1,215" note="Temperature, pressure, smoke detectors" />
          <Stat label="Material profiles" value={FIRE_MATERIALS.length} note={`${total} properties, each with a source`} />
          <Stat label="Saffire reference burns" value={SAFFIRE_BENCHMARKS.length} note="Cabin-scale results the model is compared with" />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={actionClass("secondary")} onClick={() => onShow("tables")}>
            Open the experiment tables
          </button>
          <button type="button" className={actionClass("secondary")} onClick={() => onShow("check")}>
            See the model check
          </button>
        </div>
      </Panel>

      <Panel
        title="Where the model's material inputs come from"
        description={`${total} properties across ${FIRE_MATERIALS.length} materials. Most are handbook values or modeling choices; NASA measurements anchor the ones that matter most for flammability.`}
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EVIDENCE_ORDER.map((kind) => (
            <li key={kind} className="rounded-md border border-border-subtle p-3">
              <p className="numeric text-[22px] leading-7 text-foreground">{counts[kind] ?? 0}</p>
              <EvidenceTag kind={kind} className="mt-1" />
              <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{evidenceHint(kind)}</p>
            </li>
          ))}
        </ul>
        <Note className="mt-4">
          Model output for a cabin that no experiment matches is marked <EvidenceTag kind="extrapolated" className="mx-0.5 align-middle" />. That
          includes every result at lunar and Martian gravity.
        </Note>
      </Panel>

      <Panel title="Records that support modeling" description="What each record contributes to the IGNIS fire model." flush>
        <ul className="divide-y divide-border-subtle">
          {records.map((record) => (
            <li key={record.id} className="grid gap-x-6 gap-y-2 px-5 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="min-w-0">
                <TextLink href={ROUTES.investigation(record.id)} className="text-sm font-medium">
                  {record.name}
                </TextLink>
                <p className="mt-1 text-[13px] leading-5 text-text-tertiary">{record.platform}</p>
              </div>
              {record.modelUse.length ? (
                <ul className="space-y-1 text-[13px] leading-5 text-muted-foreground">
                  {record.modelUse.map((use) => (
                    <li key={use}>{use}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] leading-5 text-text-tertiary">Not used by the model.</p>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function MaterialProperties() {
  const configured = useFireSimStore((state) => state.config.materialId);
  const [selectedId, setSelectedId] = useState(configured ?? "pmma");
  const material = materialById(selectedId);
  const properties: Array<[string, Cited<number | null>, string]> = [
    ["Piloted ignition temperature", material.ignitionTempC, "°C"],
    ["Thermal inertia kρc", material.thermalInertia, "(kW/m²K)² s"],
    ["Critical heat flux", material.criticalHeatFluxKwM2, "kW/m²"],
    ["Heat of combustion", material.heatOfCombustionMJkg, "MJ/kg"],
    ["Combustible mass per surface area", material.arealFuelKgM2, "kg/m²"],
    ["Oxygen limit in Earth gravity", material.loc1gPct, "% O₂"],
    ["Low-flow oxygen margin", material.lowFlowMarginPct, "% O₂"],
    ["CO₂ yield", material.co2Yield, "kg/kg"],
    ["CO yield in Earth gravity", material.coYield1g, "kg/kg"],
    ["Soot yield", material.sootYield, "kg/kg"],
    ["Radiative fraction", material.radiativeFraction, ""],
    ["Reference burning rate", material.refMassFluxGm2s, "g/m²s"],
  ];

  function exportParameters() {
    const payload = { parameters: materialParameterRecords(material), closures: closureParameterRecords(), activeReactionYieldsMicrogravity: reactionYields(material, 21, { gravityG: 0 }), activeReactionYields1g: reactionYields(material, 21, { gravityG: 1 }) };
    downloadText(`ignis-${material.id}-parameters.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function compareMaterial() {
    const sim = useFireSimStore.getState();
    sim.reset();
    sim.patchConfig({ materialId: material.id });
  }

  return (
    <Panel
      aria-label="Material properties"
      title="Material properties"
      description={`${FIRE_MATERIALS.length} materials found in crewed vehicles. Every value carries its evidence class and its source.`}
      actions={
        <ActionLink href={ROUTES.compare} onClick={compareMaterial}>
          Compare this material
        </ActionLink>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1 text-[12px] text-muted-foreground sm:max-w-sm">
          Material
          <select aria-label="Research material" className={fieldClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {FIRE_MATERIALS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={actionClass("secondary")} onClick={exportParameters}>
          <Download className="size-4" aria-hidden="true" />
          Export parameters and sources
        </button>
      </div>

      <p className="mt-4 text-sm leading-6 text-foreground">{material.use}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{material.nasaFinding}</p>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {material.nasaSources.map((id) => (
          <Cite key={id} id={id} />
        ))}
      </p>

      <div className={cn(table.wrap, "mt-5")}>
        <table className={cn(table.root, "min-w-[640px]")}>
          <caption className="sr-only">{material.name} properties and where each comes from</caption>
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>
                Property
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Value and source
              </th>
              <th scope="col" className={table.th}>
                Context
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map(([label, cited, unit]) => (
              <tr key={label} className={table.tr}>
                <th scope="row" className={cn(table.td, "font-normal text-foreground")}>
                  {label}
                </th>
                <td className={cn(table.td, "text-right")}>
                  <CitedValue cited={cited} unit={unit} />
                </td>
                <td className={cn(table.td, "max-w-md text-muted-foreground")}>
                  {cited.note ?? "See the cited reference. Configuration and test conditions affect whether it applies."}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Note className="mt-4">
        An oxygen limit is the result of one test configuration, not a universal threshold. Each limit keeps the pressure it was
        measured at. The model adjusts CO₂ so that the carbon in the fuel is conserved.
      </Note>
    </Panel>
  );
}

function SimpleTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: Array<Array<string | number | null>> }) {
  return (
    <div className={table.wrap}>
      <table className={table.root}>
        <caption className="sr-only">{caption}</caption>
        <thead className={table.head}>
          <tr>
            {headers.map((header, index) => (
              <th key={header} scope="col" className={cn(table.th, index ? "text-right" : "")}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className={table.tr}>
              {row.map((cell, column) => (
                <td key={column} className={column ? cn(table.num, "whitespace-nowrap") : cn(table.td, "min-w-40 text-foreground")}>
                  {cell === null || cell === "" ? <span className="text-text-tertiary">–</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Measurements() {
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Saffire: cabin-scale fire products"
        description="Tables 1 and 2 of the Saffire VI paper. All tests in microgravity with 20 cm/s airflow at the start."
        actions={<Cite id="saffire-vi" />}
      >
        <SimpleTable
          caption="Extracted Saffire measurements"
          headers={["Test and material", "O₂ (%)", "Pressure (kPa)", "Volume (m³)", "Duration (s)", "Heat release (W)", "Heat (kJ)", "CO₂ rise (ppm)", "CO rise (ppm)"]}
          rows={SAFFIRE_BENCHMARKS.map((item) => [
            `${item.id} · ${item.material}`,
            item.oxygenPct,
            item.pressureKpa,
            item.freeVolumeM3,
            item.burnDurationS,
            (() => {
              const range = peakHrrAnalyses(item.id);
              return range ? `${item.peakHeatW} peak (${range.lowW}–${range.highW} in two NASA analyses)` : `${item.peakHeatW ?? item.avgHeatW} ${item.peakHeatW === null ? "mean" : "peak"}`;
            })(),
            item.totalHeatKJ,
            item.co2RisePpm,
            item.coRisePpm,
          ])}
        />
        <Note className="mt-4">
          Mean and peak heat release are different measurements. Test VI-2 reports 580 kJ by oxygen calorimetry and 409 kJ by fuel
          consumption; both are published and neither is reconciled here. The acrylic tests changed fan settings during the burn.
          For VI-2, VI-3 and VI-4 the peak heat release comes from two NASA analyses (ICES-2024-365: 3217, 3080 and 1507 W; ICES-2026-577:
          3376, 3240 and 1487 W). Both are shown as a measured range; the model is fitted to the ICES-2024 values.
        </Note>
      </Panel>

      <SaffireDetection />

      <Panel
        title="White Sands: material flammability limits"
        description="Upward limiting oxygen index (ULOI) and maximum oxygen concentration (MOC), in % O₂, at 14.7 psia unless noted. Earth gravity."
        actions={<Cite id="hirsch-2011" />}
      >
        <SimpleTable
          caption="White Sands test results"
          headers={["Material and configuration", "ULOI (%)", "MOC (%)", "Condition"]}
          rows={WSTF_LIMITS.map((row) => [row.material, row.uloi, row.moc, row.note])}
        />
        <Note className="mt-4">
          Passing a ground test does not establish behavior in microgravity or partial gravity. <Cite id="nasa-std-6001b" />
        </Note>
      </Panel>

      <Panel
        title="SAME-2: smoke particle sizes"
        description="Diameters in micrometers, fresh and after aging 720 s, measured in microgravity from materials heated below ignition."
        actions={<Cite id="same-2" />}
      >
        <SimpleTable
          caption="SAME-2 smoke size measurements"
          headers={["Material", "Count mean, fresh", "Count mean, aged", "Mass mean, fresh", "Mass mean, aged"]}
          rows={SAME2_TABLE.map((row) => [row.material, ...row.countMean, ...row.massMean])}
        />
        <Note className="mt-4">These sizes set how the modeled detectors respond. They are not measured alarm times.</Note>
      </Panel>
    </div>
  );
}

function ratio(model: number | null, measured: number | null): string {
  return model !== null && measured !== null && measured > 0 ? `${((model / measured) * 100).toFixed(0)}%` : "–";
}

type SnapshotRow = (typeof EVALUATION_SNAPSHOT.rows)[number];
type SnapshotMetrics = SnapshotRow["inSample"];

const CHECK_QUANTITIES: Array<{ label: string; measured: (row: SnapshotRow) => number | null; modeled: (m: SnapshotMetrics) => number | null; digits: number; scale?: number; fuelFixed?: boolean }> = [
  { label: "Heat release (W)", measured: (row) => row.measured.hrrW, modeled: (m) => m.hrrW, digits: 0, fuelFixed: true },
  { label: "Total heat (kJ)", measured: (row) => row.measured.heatKJ, modeled: (m) => m.heatKJ, digits: 0, fuelFixed: true },
  { label: "CO₂ rise (ppm)", measured: (row) => row.measured.co2Ppm, modeled: (m) => m.co2Ppm, digits: 0 },
  { label: "CO rise (ppm)", measured: (row) => row.measured.coPpm, modeled: (m) => m.coPpm, digits: 0 },
  { label: "CO/CO₂ (%)", measured: (row) => row.measured.coCo2, modeled: (m) => m.coCo2, digits: 2, scale: 100 },
  { label: "Burn duration (s)", measured: (row) => row.measured.durationS, modeled: (m) => m.durationS, digits: 0 },
];

const VERDICT_TONE: Record<string, string> = {
  agrees: "text-status-nominal",
  "partly agrees": "text-status-caution",
  disagrees: "text-status-warning",
  uninformative: "text-muted-foreground",
};

function show(value: number | null, digits: number, scale = 1) {
  return value === null ? <span className="text-text-tertiary">–</span> : (value * scale).toFixed(digits);
}

/** Beside the peak heat release of VI-2, VI-3 and VI-4: the two-analysis measured range, and whether the model falls inside it. */
function PeakRangeNote({ row, label, part }: { row: SnapshotRow; label: string; part: "measured" | "inSample" | "heldOut" }) {
  if (label !== "Heat release (W)" || row.hrrBasis !== "peak") return null;
  const status = peakHrrRangeStatus([row])[0];
  if (!status) return null;
  const text = part === "measured"
    ? `range ${status.lowW}–${status.highW} (ICES-2024 ${status.ices2024W}, ICES-2026 ${status.ices2026W})`
    : (part === "inSample" ? status.inSampleInside : status.heldOutInside) ? "inside the range" : "outside the range";
  return <span className="mt-0.5 block text-[12px] leading-4 text-text-tertiary">{text}</span>;
}

function ModelCheck() {
  const rows = EVALUATION_SNAPSHOT.rows;
  const consistency = EVALUATION_SNAPSHOT.consistency;
  const metric = (id: string) => ACCURACY_SUMMARY.find((m) => m.metric === id)!;
  const hrr = metric("hrr"), heat = metric("heat"), co2 = metric("co2"), co = metric("co");
  const scored = EVALUATION_SNAPSHOT.independent.filter((c) => c.verdict !== "uninformative" && c.basis !== "in-sample consistency");
  const peakRanges = peakHrrRangeStatus(rows);
  const agreeing = scored.filter((c) => c.verdict === "agrees").length;
  const cfastGap = cfastTemperatureGap();
  const fixedRows = rows.filter((row) => row.fixedByFuel).map((row) => row.id);

  function exportComparison() {
    const payload = {
      scope: `IGNIS model ${FIRE_MODEL_VERSION} compared with published Saffire summaries (in-sample and leave-one-out) and independent NASA flight tables`,
      sources: [
        "https://ntrs.nasa.gov/citations/20240002981",
        "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98",
        "https://psi.nasa.gov/physci/repo/data/investigations/PSI-99",
        "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
      ],
      evaluation: EVALUATION_SNAPSHOT,
      summary: ACCURACY_SUMMARY,
    };
    downloadText("ignis-saffire-comparison.json", JSON.stringify(payload, null, 2), "application/json");
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="The model against four Saffire burns"
        description="Each test starts at 20 cm/s. VI-3 follows NASA’s published fan changes; VI-4’s complete airflow history is unavailable, so its reproduction remains incomplete. Modeled: fitted to these tests. Held-out: re-fitted without the test being predicted."
        actions={<Cite id="saffire-vi" />}
        flush
      >
        <div className="overflow-x-auto">
          <table className={table.root} aria-label="Saffire model comparison">
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>Test</th>
                <th scope="col" className={table.th}>Quantity</th>
                <th scope="col" className={cn(table.th, "text-right")}>Published</th>
                <th scope="col" className={cn(table.th, "text-right")}>Modeled</th>
                <th scope="col" className={cn(table.th, "text-right")}>Modeled ÷ published</th>
                <th scope="col" className={cn(table.th, "text-right")}>Held-out</th>
                <th scope="col" className={cn(table.th, "text-right")}>Held-out ÷ published</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((row) => {
                const quantities = CHECK_QUANTITIES.filter((q) => q.measured(row) !== null);
                return quantities.map((quantity, index) => (
                  <tr key={`${row.id}-${quantity.label}`} className={table.tr}>
                    {index === 0 ? (
                      <th scope="rowgroup" rowSpan={quantities.length} className={cn(table.td, "font-medium whitespace-nowrap text-foreground")}>
                        {row.id}
                        <span className="block text-[12px] font-normal text-text-tertiary">
                          {row.materialId === "sibal" ? "SIBAL" : "PMMA"}, {row.hrrBasis} heat release
                        </span>
                      </th>
                    ) : null}
                    <td className={cn(table.td, "text-muted-foreground")}>
                      {quantity.label}
                      {row.fixedByFuel && quantity.fuelFixed ? (
                        <span className="mt-0.5 block text-[12px] leading-4 text-text-tertiary">Fixed by fuel mass and ΔHc, not a test</span>
                      ) : null}
                    </td>
                    <td className={table.num}>
                      {show(quantity.measured(row), quantity.digits, quantity.scale)}
                      <PeakRangeNote row={row} label={quantity.label} part="measured" />
                    </td>
                    <td className={table.num}>
                      {show(quantity.modeled(row.inSample), quantity.digits, quantity.scale)}
                      <PeakRangeNote row={row} label={quantity.label} part="inSample" />
                    </td>
                    <td className={table.num}>{ratio(quantity.modeled(row.inSample), quantity.measured(row))}</td>
                    <td className={table.num}>
                      {show(quantity.modeled(row.heldOut), quantity.digits, quantity.scale)}
                      <PeakRangeNote row={row} label={quantity.label} part="heldOut" />
                    </td>
                    <td className={table.num}>{ratio(quantity.modeled(row.heldOut), quantity.measured(row))}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Error summary"
        description={`Absolute error against the published values: median and worst case over the tests. The data band is how far the published measurements disagree with each other.${fixedRows.length ? ` Heat release and total heat leave out ${fixedRows.join(", ")}, whose published heat is fuel mass × ΔHc from the same table.` : ""}`}
        flush
      >
        {peakRanges.length ? (
          <Note className="mx-5 mt-4">
            Heat release errors are against the ICES-2024-365 peak, the value the model is fitted to. NASA&apos;s second analysis (ICES-2026-577) gives
            a different peak for the same tests, so the measured value is a range. The modeled peak is inside that range for{" "}
            {peakRanges.filter((r) => r.inSampleInside).length} of {peakRanges.length} tests in-sample and{" "}
            {peakRanges.filter((r) => r.heldOutInside).length} of {peakRanges.length} held out
            ({peakRanges.map((r) => `${r.id} ${r.lowW}–${r.highW} W`).join("; ")}). Acceptance thresholds are unchanged.
          </Note>
        ) : null}
        <div className="overflow-x-auto">
          <table className={table.root} aria-label="Model error summary">
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>Quantity</th>
                <th scope="col" className={cn(table.th, "text-right")}>In-sample, median / worst</th>
                <th scope="col" className={cn(table.th, "text-right")}>Held-out, median / worst</th>
                <th scope="col" className={cn(table.th, "text-right")}>Tests</th>
                <th scope="col" className={cn(table.th, "text-right")}>Data band</th>
                <th scope="col" className={table.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {ACCURACY_SUMMARY.map((m) => (
                <tr key={m.metric} className={table.tr}>
                  <th scope="row" className={cn(table.td, "font-normal text-foreground")} title={m.applicability}>
                    {m.label}
                  </th>
                  <td className={table.num}>
                    {m.inSample.medianAbs.toFixed(0)} / {m.inSample.maxAbs.toFixed(0)} {m.unit}
                  </td>
                  <td className={table.num}>
                    {m.heldOut.medianAbs.toFixed(0)} / {m.heldOut.maxAbs.toFixed(0)} {m.unit}
                  </td>
                  <td className={table.num}>{m.heldOut.n}</td>
                  <td className={table.num}>{m.dataBand === null ? <span className="text-text-tertiary">–</span> : `±${m.dataBand.toFixed(0)} ${m.unit}`}</td>
                  <td className={cn(table.td, m.established ? "text-muted-foreground" : "text-status-caution")} title={m.note}>
                    {!m.established ? "Not established" : m.fitted ? "Fitted" : "Not fitted"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Independent checks"
        description="Flight data no coefficient was fitted to: Saffire I and II burns, BASS-II gas measurements, and the Saffire VI temperature, pressure and smoke-alarm readings of ICES-2026-577. Rows marked in-sample consistency compare a quantity the calibration already constrains and are not counted as tests."
        flush
      >
        <Note className="mx-5 mt-4">
          Cabin temperature accuracy is not established. The far-field rises are 0–5 K point readings against an assumed 20 °C start
          {cfastGap ? `, and NIST CFAST gives ${cfastGap.low.toFixed(0)}–${cfastGap.high.toFixed(0)} times the IGNIS cabin rise on identical heat release` : ""}.
        </Note>
        <div className="overflow-x-auto">
          <table className={table.root} aria-label="Independent model checks">
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>Check</th>
                <th scope="col" className={table.th}>Quantity</th>
                <th scope="col" className={cn(table.th, "text-right")}>Measured</th>
                <th scope="col" className={cn(table.th, "text-right")}>Model</th>
                <th scope="col" className={table.th}>Result</th>
              </tr>
            </thead>
            <tbody>
              {EVALUATION_SNAPSHOT.independent.map((check) => (
                <tr key={check.id} className={table.tr}>
                  <th scope="row" className={cn(table.td, "font-normal whitespace-nowrap text-foreground")}>
                    {check.id}
                  </th>
                  <td className={cn(table.td, "min-w-56 text-muted-foreground")}>
                    {check.quantity}
                    {check.unit ? ` (${check.unit})` : ""}
                    {check.basis ? <span className="ml-2 text-[12px] text-text-tertiary">{check.basis === "held-out" ? "held out" : check.basis}</span> : null}
                    <span className="mt-1 block text-[12px] leading-4 text-text-tertiary">{check.note}</span>
                  </td>
                  <td className={cn(table.num, "whitespace-nowrap")}>{check.measured}</td>
                  <td className={cn(table.num, "whitespace-nowrap")}>{check.model}</td>
                  <td className={cn(table.td, "whitespace-nowrap", VERDICT_TONE[check.verdict])}>
                    {check.verdict}
                    {check.errorPct !== null ? (
                      <span className="block text-[12px] text-text-tertiary">
                        {check.errorPct > 0 ? "+" : ""}
                        {check.errorPct.toFixed(0)}%
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.map((row) => {
                const outletRatio = row.inSample.outletRiseK / row.measured.outletRiseK;
                return (
                  <tr key={`${row.id}-temperature`} className={table.tr}>
                    <th scope="row" className={cn(table.td, "font-normal whitespace-nowrap text-foreground")}>
                      {row.id} temperatures
                    </th>
                    <td className={cn(table.td, "min-w-56 text-muted-foreground")}>
                      Duct outlet rise / cabin far-field rise (K)
                      <span className="mt-1 block text-[12px] leading-4 text-text-tertiary">
                        Outlet: source and bypass air mixed after modeled heat losses, using the current fan speed. Duct and sensor geometry remain unresolved. Both rises assume a 20 °C start.
                      </span>
                    </td>
                    <td className={cn(table.num, "whitespace-nowrap")}>
                      {row.measured.outletRiseK.toFixed(0)} / {row.measured.farFieldRiseK.toFixed(0)}
                    </td>
                    <td className={cn(table.num, "whitespace-nowrap")}>
                      {row.inSample.outletRiseK.toFixed(0)} / {row.inSample.farFieldRiseK.toFixed(1)}
                    </td>
                    <td className={cn(table.td, "whitespace-nowrap", outletRatio > 1.5 || outletRatio < 0.5 ? VERDICT_TONE.disagrees : VERDICT_TONE["partly agrees"])}>
                      {outletRatio > 1.5 ? "outlet too hot" : outletRatio < 0.5 ? "outlet too cool" : "outlet partly agrees"}
                      <span className="block text-[12px] text-text-tertiary">
                        far field {Math.abs(row.inSample.farFieldRiseK - row.measured.farFieldRiseK).toFixed(1)} K off
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="The published data disagree with themselves">
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Heat release can be estimated two ways from the same paper: the published value, and a carbon balance on the published CO₂ and CO
          rises. They differ by {consistency.heatRangePct[0].toFixed(0)}% to {consistency.heatRangePct[1].toFixed(0)}%, median{" "}
          {consistency.heatBandPct.toFixed(0)}%. That median is the data band used above for heat release, heat and CO₂.
        </p>
        <div className={cn(table.wrap, "mt-4")}>
          <table className={table.root} aria-label="Saffire heat release consistency">
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>Test</th>
                <th scope="col" className={cn(table.th, "text-right")}>Published heat (kJ)</th>
                <th scope="col" className={cn(table.th, "text-right")}>From CO₂ and CO (kJ)</th>
                <th scope="col" className={cn(table.th, "text-right")}>Ratio</th>
                <th scope="col" className={cn(table.th, "text-right")}>CO₂ per kJ (ppm)</th>
              </tr>
            </thead>
            <tbody>
              {consistency.rows.map((row) => (
                <tr key={row.id} className={table.tr}>
                  <th scope="row" className={cn(table.td, "font-normal text-foreground")}>
                    {row.id}
                  </th>
                  <td className={cn(table.num, "whitespace-nowrap")}>
                    {row.publishedHeatKJ}
                    {row.id === "VI-2" ? ` (${consistency.vi2FuelConsumptionKJ} by fuel use)` : ""}
                  </td>
                  <td className={table.num}>{row.carbonHeatKJ.toFixed(0)}</td>
                  <td className={table.num}>{row.ratio.toFixed(2)}</td>
                  <td className={table.num}>{row.co2PpmPerKJ.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note className="mt-4">
          VI-3 and VI-4 burned the same acrylic in nearly the same cabin, yet released 6.7 and 9.8 ppm of CO₂ per kJ. No single model can
          match both heat and CO₂ for those tests; the fit splits the difference.
        </Note>
      </Panel>

      <Panel title="How to read this">
        <div className="max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            <span className="text-foreground">
              On held-out Saffire VI tests, heat release is within {hrr.heldOut.medianAbs.toFixed(0)}% (median; worst {hrr.heldOut.maxAbs.toFixed(0)}%, {hrr.heldOut.n} tests).
            </span>{" "}
            {fixedRows.length ? `${fixedRows.join(", ")} is left out of the heat statistics because its published heat is simply fuel mass × ΔHc. ` : ""}
            Total heat and CO₂ are off by {heat.heldOut.medianAbs.toFixed(0)}% and {co2.heldOut.medianAbs.toFixed(0)}% (median); the two published
            estimates of the same heat differ by {consistency.heatBandPct.toFixed(0)}% (median), and no model can match both. CO is within{" "}
            {co.heldOut.medianAbs.toFixed(0)}% (median) using a CO/CO₂ ratio fitted to the four Saffire VI tests, rather than Earth handbook yields;
            BASS-II glovebox runs agree with that ratio independently.
          </p>
          <p>
            The independent checks are weaker: {agreeing} of {scored.length} agree. Saffire I and II spread more slowly over the same fabric than
            the Saffire VI tests imply, and the model grows acrylic fires faster at 22 % O₂ than Saffire II saw. Outlet mixing accounts for modeled heat losses,
            but outlet and cabin temperature accuracy remain unestablished. VI-4’s incomplete airflow history limits the heat comparison.
          </p>
          <p>
            Every comparison is at 0 g. The held-out error applies in the interface only to runs close to one Saffire VI test (same material
            and sample size, oxygen within 1 point and pressure within 5 % of that test, matching concurrent airflow history). Lunar and Martian results use
            the same coefficients with assumed scaling and are extrapolated.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className={actionClass("secondary")} onClick={exportComparison}>
            <Download className="size-4" aria-hidden="true" />
            Export comparison (JSON)
          </button>
          <ExternalLink href="https://ntrs.nasa.gov/citations/20240002981">Saffire VI paper on NTRS</ExternalLink>
        </div>
      </Panel>

      <CfastCrosscheck />
    </div>
  );
}

function Sources() {
  return (
    <Panel
      id="sources"
      title="Sources read for the model"
      description={`${FIRE_SOURCES.length} documents, with what was taken from each. Checked ${RETRIEVED_AT}.`}
      flush
    >
      <ul className="divide-y divide-border-subtle">
        {FIRE_SOURCES.map((source) => (
          <li key={source.id} id={`source-${source.id}`} className="scroll-mt-4 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <h3 className="min-w-0 flex-1 basis-72 text-sm leading-6 font-medium text-foreground">{source.title}</h3>
              <span className="flex flex-wrap items-center gap-2">
                <Tag>{SOURCE_KIND_LABEL[source.kind]}</Tag>
                {source.url ? <ExternalLink href={source.url}>Open</ExternalLink> : null}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-5 text-text-tertiary">
              {source.authors} · {source.venue}
              {source.year ? ` · ${source.year}` : ""}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-5 text-muted-foreground">
              {source.extracted.map((statement) => (
                <li key={statement}>{statement}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
