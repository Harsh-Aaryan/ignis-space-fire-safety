"use client";

import Link from "next/link";
import {
  EQUIPMENT_PROFILES,
  objectById,
  roomById,
  type EquipmentProfile,
} from "@/data/habitat-interiors";
import { RelevanceChart } from "@/components/charts/evidence-charts";
import { useAnalysis } from "@/hooks/use-analysis";
import { useMissionStore } from "@/stores/mission-store";
import { equipmentLabel, FUEL_LABEL, MEASUREMENT_META } from "@/lib/labels";
import { citationMatchesObjective } from "@/lib/analytics/gap-class";
import { oxygenPartialPressurePsi } from "@/lib/physics/atmosphere";
import { EMPTY_FILTERS } from "@/lib/evidence/filters";
import { formatGravity, formatNumber, formatRelevance } from "@/lib/format";
import type { EquipmentId } from "@/types/domain";

const SYSTEMS: EquipmentId[] = [
  "shell",
  "airlock-oxygen",
  "living-quarters",
  "laboratory",
  "material-storage",
  "ventilation",
  "smoke-detection",
  "fire-suppression",
];
function Section({
  title,
  children,
  open = true,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="group border-b border-[#343A40] py-3">
      <summary className="cursor-pointer font-cond text-[12px] tracking-[0.1em] text-[#D5D4CC] uppercase">
        {title}
      </summary>
      <div className="mt-3 space-y-3 text-[12px] leading-5">{children}</div>
    </details>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#2C3237] py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="numeric text-right">{value}</dd>
    </div>
  );
}
export function InteriorInspector() {
  const analysis = useAnalysis();
  const state = useMissionStore();
  const { scenario, selectedEquipment, selectedObjectId, selectedRoomId } =
    state;
  const object = objectById(selectedObjectId);
  const room = roomById(selectedRoomId);
  const profile: EquipmentProfile | undefined =
    object ??
    Object.values(EQUIPMENT_PROFILES).find(
      (p) => p.system === selectedEquipment,
    );
  const equipment = selectedEquipment ?? "shell";
  const linked = analysis.ranked.filter(
    (row) =>
      equipment === "shell" ||
      row.investigation.equipmentLinks.includes(equipment),
  );
  const citations =
    analysis.dataMode === "synthetic"
      ? []
      : analysis.citations.filter((c) =>
          profile
            ? profile.families.some(
                (f) => c.indexHint === f || c.indexHint.startsWith(f + "-"),
              ) || citationMatchesObjective(c, profile.objective)
            : true,
        );
  const bestRun = linked[0]?.runs[0]?.run;
  const measurements =
    bestRun?.measurements.filter(
      (m) => m.value !== null && m.status === "present",
    ) ?? [];
  const title =
    object?.label ??
    room?.name ??
    (selectedEquipment
      ? equipmentLabel(equipment, scenario.missionId)
      : "Habitat inspector");
  function compare() {
    state.clearComparison();
    linked
      .slice(0, 3)
      .forEach((row) => state.toggleComparison(row.investigation.id));
    state.setFilters({
      ...EMPTY_FILTERS,
      families: [
        ...new Set(linked.slice(0, 3).map((row) => row.investigation.family)),
      ],
    });
  }
  const context = `${title} in ${room?.name ?? scenario.name}: oxygen ${scenario.oxygenPct}%, pressure ${scenario.pressurePsi} psi, gravity ${scenario.gravityG} g, airflow ${scenario.airflowMs} m/s.`;
  return (
    <aside
      aria-label="Research inspector"
      className="shrink-0 border-t border-[#343A40] bg-[#1F2125] xl:min-h-0 xl:overflow-y-auto xl:border-t-0 xl:border-l"
    >
      <header className="z-10 border-b border-[#343A40] bg-[#1F2125] px-4 py-3 xl:sticky xl:top-0">
        <p className="font-cond text-[10px] tracking-[0.16em] text-[#B89F7A] uppercase">
          FireTwin / research inspector
        </p>
        <h2 aria-live="polite" className="mt-1 text-[17px] font-medium">
          {title}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {object
            ? "Selected equipment"
            : room
              ? "Selected room"
              : "Select a room or an object to explore its evidence."}
          {room
            ? ` · ${scenario.missionId === "gateway-orbit" ? "Pressurized module" : `Level ${room.level}`}`
            : ""}
        </p>
      </header>
      <div className="px-4 pb-6">
        <Section title="Overview">
          <p>
            {object?.description ??
              (room
                ? `Explore ${room.equipment.length} inspection objects in this conceptual ${room.name.toLowerCase()} space.`
                : "Open a cutaway, choose a room, then select its equipment directly in the scene or below.")}
          </p>
          {object ? (
            <p className="break-all font-mono text-[10px] text-muted-foreground">
              Object ID · {object.id}
            </p>
          ) : null}
          {room ? (
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Room equipment"
            >
              {room.equipment.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  data-object-id={item.id}
                  aria-pressed={selectedObjectId === item.id}
                  onClick={() => state.selectObject(item.id)}
                  className={`min-h-8 border px-2 py-1 text-left text-[11px] ${selectedObjectId === item.id ? "border-[#D6A477] bg-[#38332D] text-[#F0DBC1]" : "border-[#41494E] text-[#BCC1BE] hover:bg-[#30373C]"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <details>
            <summary className="cursor-pointer text-[11px] text-muted-foreground">
              All habitat systems
            </summary>
            <div
              className="mt-2 flex flex-wrap gap-1"
              aria-label="Habitat systems"
            >
              {SYSTEMS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={equipment === id}
                  onClick={() => state.selectEquipment(id)}
                  className="border border-[#41494E] px-2 py-1 text-[10px]"
                >
                  {equipmentLabel(id, scenario.missionId)}
                </button>
              ))}
            </div>
          </details>
        </Section>
        {state.firetwinMode === "scenario" ? (
          <p className="mt-3 border border-[#8A7040] bg-[#2A2418] p-3 text-[12px] text-[#E8C15A]">
            Scenario interpretation ?{" "}
            {analysis.gaps.find((gap) => gap.dimension === "gravity")
              ?.explanation ?? "Similarity is not a transfer proof."}{" "}
            Coverage is evidence availability, not a safety rating.
          </p>
        ) : null}
        <Section title="Conditions">
          <p className="text-[11px] text-muted-foreground">
            Cabin scenario inputs · shared with Research, GravityBridge and
            FireLab.
          </p>
          {(
            [
              ["oxygenPct", "Oxygen (%)", 15, 45, 0.5],
              ["pressurePsi", "Cabin pressure (psi)", 5, 20, 0.1],
              ["airflowMs", "Airflow (m/s)", 0, 1, 0.01],
            ] as const
          ).map(([key, label, min, max, step]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3"
            >
              <span>{label}</span>
              <input
                aria-label={`Inspector ${label}`}
                type="number"
                min={min}
                max={max}
                step={step}
                value={scenario[key]}
                onChange={(e) => {
                  const value = e.currentTarget.valueAsNumber;
                  if (Number.isFinite(value) && value >= min && value <= max)
                    state.patchScenario({ [key]: value });
                }}
                className="numeric w-20 rounded-sm border border-[#465057] bg-[#171C20] px-2 py-1"
              />
            </label>
          ))}
          <dl>
            <Row
              label="Oxygen partial pressure"
              value={
                <span data-testid="oxygen-partial-pressure">
                  {formatNumber(
                    oxygenPartialPressurePsi(
                      scenario.oxygenPct,
                      scenario.pressurePsi,
                    ),
                    3,
                  )}{" "}
                  psi
                </span>
              }
            />
            <Row
              label="Gravity"
              value={`${formatGravity(scenario.gravityG)} g`}
            />
            <Row
              label="Material context"
              value={FUEL_LABEL[scenario.fuelCategory]}
            />
          </dl>
          {object?.type === "duct" ? (
            <p>
              Assumed supply airflow: {scenario.airflowMs} m/s. No computed
              convection field.
            </p>
          ) : null}
        </Section>
        <Section title="Research">
          {profile ? (
            <p className="text-muted-foreground">
              Indexed topics: {profile.families.join(", ")}. Matching topics do
              not establish hardware applicability.
            </p>
          ) : null}
          {citations.length ? (
            <div>
              <p className="mb-2 text-[10px] tracking-[0.08em] text-[#9FBFBA] uppercase">
                Verified NASA citation metadata
              </p>
              <ul className="space-y-2">
                {citations.slice(0, 4).map((c) => (
                  <li key={c.id} className="border-l border-[#667A79] pl-2">
                    <Link
                      href={`/research/${c.id}`}
                      className="text-[#C5D8D3] hover:underline"
                    >
                      {c.title}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">
                      {c.indexHint} · {c.year ?? "Year unreported"} · numeric
                      conditions not extracted
                    </p>
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-[#D2AF8A] underline"
                    >
                      NASA source ↗
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Verified metadata; experimental measurements have not been
                extracted.
              </p>
            </div>
          ) : null}
          {linked.length ? (
            <div>
              <p className="mb-1 text-[10px] tracking-[0.08em] text-[#D2AF8A] uppercase">
                Synthetic demonstration dossiers
              </p>
              <ul>
                {linked.slice(0, 4).map((row) => (
                  <li
                    key={row.investigation.id}
                    className="border-b border-[#343A40] py-2"
                  >
                    <div className="flex justify-between gap-2">
                      <Link
                        href={`/research/${row.investigation.id}`}
                        className="text-[#E4B48B] hover:underline"
                      >
                        {row.investigation.family}
                      </Link>
                      <span className="numeric">
                        {formatRelevance(row.relevance)} relevance
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {row.investigation.title}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Relevance is a heuristic for research discovery, not a hazard
                score. It updates with cabin inputs.
              </p>
            </div>
          ) : null}
          {!linked.length && !citations.length ? (
            <p>
              No matching records in the selected evidence mode. Missing
              evidence is not a negative result.
            </p>
          ) : null}
        </Section>
        <Section title="Analysis" open={false}>
          {profile ? (
            <>
              <p className="text-muted-foreground">
                Relevant parameters: {profile.parameters.join(", ")}.
              </p>
              <p>{profile.limitation}</p>
            </>
          ) : null}
          <p className="border-l-2 border-[#B29361] pl-2">
            {analysis.indexed.summary}{" "}
            {scenario.gravityG > 0.05 && scenario.gravityG < 0.8
              ? "No numeric partial-gravity runs are available in the current corpus."
              : "Matching gravity alone does not establish comparable conditions."}
          </p>
          {bestRun ? (
            <>
              <p className="text-[10px] tracking-[0.08em] text-[#D2AF8A] uppercase">
                Closest synthetic run · {bestRun.id}
              </p>
              <dl>
                <Row label="Sample geometry" value={bestRun.sampleGeometry} />
                <Row
                  label="Test oxygen / pressure"
                  value={`${bestRun.oxygenConcentrationPct ?? "Missing"}% / ${bestRun.pressurePsi ?? "Missing"} psi`}
                />
                <Row
                  label="Test gravity / airflow"
                  value={`${bestRun.gravityG ?? "Missing"} g / ${bestRun.airflowVelocityMs ?? "Missing"} m/s`}
                />
              </dl>
              <ul>
                {measurements.slice(0, 4).map((m) => (
                  <li key={m.type} className="flex justify-between gap-2">
                    <span>{MEASUREMENT_META[m.type].label}</span>
                    <span className="numeric">
                      {m.value} {m.unit}
                      {m.uncertainty !== null
                        ? ` ± ${m.uncertainty}`
                        : " · uncertainty unavailable"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                Synthetic measurements only. {bestRun.uncertaintyNote}
              </p>
              <RelevanceChart rows={linked} />
            </>
          ) : (
            <p>No numeric measurements are available in this evidence mode.</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            No model hazard prediction is computed. Missing measurements are
            never treated as zero.
          </p>
        </Section>
        <Section title="Actions">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/research"
              onClick={compare}
              className="border border-[#4B555B] px-2 py-2 text-center hover:bg-[#30373C]"
            >
              Compare investigations
            </Link>
            <Link
              href="/gravity-bridge"
              className="border border-[#4B555B] px-2 py-2 text-center hover:bg-[#30373C]"
            >
              Open GravityBridge
            </Link>
            <Link
              href="/firelab"
              onClick={() =>
                state.setAssistantDraft(
                  `${context} What relevant investigations and evidence limitations should I consider?`,
                )
              }
              className="border border-[#4B555B] px-2 py-2 text-center hover:bg-[#30373C]"
            >
              Ask IGNIS AI
            </Link>
            <Link
              href="/firelab"
              onClick={() =>
                state.setAssistantDraft(
                  `${context} What should researchers investigate next? Explain gaps and suggest an experiment for this equipment.`,
                )
              }
              className="border border-[#8D775F] px-2 py-2 text-center text-[#E4C09B] hover:bg-[#38332D]"
            >
              FireLab recommendation
            </Link>
          </div>
        </Section>
        <Section title="Model information & credits" open={false}>
          <p>
            Illustrative digital twin. Interior layouts, dimensions, room
            assignments and equipment are conceptual, not an official NASA, ESA,
            Foster+Partners or AI SpaceFactory configuration, a flown vehicle or
            a certified design.
          </p>
          <p>
            {scenario.missionId === "gateway-orbit"
              ? "NASA Gateway Core model: NASA/JSC/Gateway Program Office; Alberto G. Bertolin and Bradley W. Reynolds, Graphics and Animation LAB JSC. The model remains intact; only the selected module shell becomes transparent. Gateway remains in microgravity."
              : scenario.missionId === "mars-habitat"
                ? "Exterior inspired by AI SpaceFactory MARSHA. Cabin inputs are separate from the thin exterior Martian atmosphere. Four levels follow the existing shell geometry."
                : "Exterior inspired by the Foster+Partners / ESA lunar habitation concept. The two existing deck heights are retained. Cabin atmosphere is separate from the exterior lunar vacuum."}
          </p>
          <p>
            Procedural interior geometry; no additional third-party model
            assets. Existing exterior credits are retained in ATTRIBUTIONS.md.
          </p>
        </Section>
      </div>
    </aside>
  );
}
