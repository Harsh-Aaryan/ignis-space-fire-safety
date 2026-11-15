import { ActionLink, EvidenceTag, Note, Panel, SectionHeading, TextLink, table } from "@/components/design/kit";
import { Cite, evidenceClass } from "@/components/fire/cite";
import { KindTag } from "@/components/research/record-meta";
import { FIRE_SENSORS, HAZARD_LIMITS, SAFFIRE_IV_VI_EMISSION, SAFFIRE_IV_VI_EMISSION_META, SUPPRESSION_ACTIONS } from "@/data/fire/options";
import { GRAVITY_REGIMES, TOPICS, type InvestigationRecord } from "@/data/research/investigations";
import { controlRecords, partialGravityGaps, type ControlGroupId } from "@/lib/research/coverage";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const GROUPS: Array<{ id: ControlGroupId; title: string; description: string }> = [
  {
    id: "detection",
    title: "Detection",
    description: "What a detector has to sense, where it has to be, and how soon it can know.",
  },
  {
    id: "suppression",
    title: "Suppression and response",
    description: "What puts a fire out in a cabin, and what the response does to the air the crew breathes.",
  },
  {
    id: "materials",
    title: "Material and atmosphere controls",
    description: "Preventing the fire: which materials may fly, and the limits the cabin atmosphere is held to.",
  },
];

/** Detection, suppression and controls: what the research tells the designers of the next equipment. */
export function ControlsView() {
  return (
    <div className="flex min-w-0 flex-col gap-12">
      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {GROUPS.map((group) => (
          <a
            key={group.id}
            href={`#${group.id}`}
            className="inline-flex min-h-10 items-center rounded-md border border-border-subtle px-3 text-sm text-muted-foreground transition-colors hover:bg-elev-2 hover:text-foreground"
          >
            {group.title}
          </a>
        ))}
      </nav>

      {GROUPS.map((group) => (
        <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="scroll-mt-4">
          <SectionHeading id={`${group.id}-heading`} title={group.title} description={group.description} className="mb-4" />
          <div className="flex flex-col gap-5">
            <Implications records={controlRecords(group.id)} />
            {group.id === "detection" ? <AlarmTiming /> : null}
            {group.id === "detection" ? <SensorTable /> : null}
            {group.id === "suppression" ? <ActionTable /> : null}
            <NotCovered group={group.id} />
          </div>
        </section>
      ))}
    </div>
  );
}

function Implications({ records }: { records: InvestigationRecord[] }) {
  const withStatements = records.filter((record) => record.controlsUse.length);
  return (
    <Panel title="What the research says to designers" flush>
      <ul className="divide-y divide-border-subtle">
        {withStatements.map((record) => (
          <li key={record.id} className="grid gap-x-8 gap-y-3 px-5 py-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
            <div className="min-w-0">
              <ul className="space-y-2">
                {record.controlsUse.map((statement) => (
                  <li key={statement} className="flex max-w-[62ch] gap-3 text-sm leading-6 text-foreground">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-text-tertiary" aria-hidden="true" />
                    {statement}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <TextLink href={ROUTES.investigation(record.id)} className="text-sm font-medium">
                  {record.name}
                </TextLink>
                <KindTag record={record} />
              </p>
              <p className="mt-1.5 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">
                {record.findings[0].text} {record.findings[0].sourceId ? <Cite id={record.findings[0].sourceId} compact /> : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The Saffire IV–VI alarm-timing result: what a 2 mg/m³ far-field threshold did. */
function AlarmTiming() {
  const alarm = SAFFIRE_IV_VI_EMISSION_META.alarmThresholdMgM3.value;
  const co24h = HAZARD_LIMITS.co24hPpm.value;
  const acrylic = SAFFIRE_IV_VI_EMISSION.filter((test) => test.id === "VI-3" || test.id === "VI-4");
  return (
    <Panel
      title="Smoke alarm timing in Saffire IV–VI"
      description="Total particulate at the far-field detector, alarm reference of 2 mg/m³, in seven flight tests."
      actions={<Cite id="saffire-iv-vi-emission" />}
    >
      <ul className="space-y-2">
        <li className="flex max-w-[62ch] gap-3 text-sm leading-6 text-foreground">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-text-tertiary" aria-hidden="true" />
          A {alarm} mg/m³ threshold detected both Saffire VI acrylic fires only after the CO rise passed the {co24h} ppm 24-hour limit
          ({acrylic.map((test) => `${test.id}: ${test.coRiseAtAlarmPpm} ppm`).join(", ")} at alarm). The authors conclude that this spacecraft would need a lower threshold or more
          detectors to shorten transport time.
        </li>
        <li className="flex max-w-[62ch] gap-3 text-sm leading-6 text-foreground">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-text-tertiary" aria-hidden="true" />
          The detector sat on a direct path from the fire, so detection in Cygnus was likely quicker than it would be on the ISS, where mixing is more extensive.
        </li>
      </ul>
      <Note className="mt-4">
        The simulator&apos;s alarm thresholds stay at the values in the table below. {alarm} mg/m³ is the reference NASA used for these tests; the ICES-2024-365 paper used 1 mg/m³.{" "}
        <TextLink href={`${ROUTES.modelingData}?view=measurements`}>Per-test alarm times and gas rises</TextLink>
      </Note>
    </Panel>
  );
}

function SensorTable() {
  return (
    <Panel
      title="Detectors in the simulation"
      description="Five sensor types can be switched on in a fire scenario. Their operating principles follow the research; their alarm thresholds are modeling choices."
      actions={<ActionLink href={ROUTES.simulation}>Try them in a scenario</ActionLink>}
      flush
    >
      <div className="overflow-x-auto">
        <table className={table.root}>
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>
                Sensor
              </th>
              <th scope="col" className={table.th}>
                How it senses a fire
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Alarm threshold
              </th>
              <th scope="col" className={table.th}>
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {FIRE_SENSORS.map((sensor) => (
              <tr key={sensor.id} className={table.tr}>
                <th scope="row" className={cn(table.td, "min-w-44 font-medium text-foreground")}>
                  {sensor.name}
                </th>
                <td className={cn(table.td, "min-w-64 text-muted-foreground")}>{sensor.principle}</td>
                <td className={cn(table.td, "text-right whitespace-nowrap")}>
                  <span className="numeric text-foreground">
                    {sensor.threshold.value} {sensor.unit}
                  </span>
                  <span className="mt-1 block">
                    <EvidenceTag kind={evidenceClass(sensor.threshold)} />
                  </span>
                </td>
                <td className={table.td}>
                  <span className="flex flex-wrap gap-1.5">
                    {sensor.sources.map((id) => (
                      <Cite key={id} id={id} compact />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ActionTable() {
  return (
    <Panel
      title="Responses in the simulation"
      description="The actions available during a fire scenario, with the agent quantities taken from the flight hardware where they are published."
      actions={<ActionLink href={ROUTES.simulation}>Try them in a scenario</ActionLink>}
      flush
    >
      <div className="overflow-x-auto">
        <table className={table.root}>
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>
                Action
              </th>
              <th scope="col" className={table.th}>
                How it works
              </th>
              <th scope="col" className={table.th}>
                What to watch for
              </th>
              <th scope="col" className={cn(table.th, "text-right")}>
                Agent
              </th>
              <th scope="col" className={table.th}>
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {SUPPRESSION_ACTIONS.map((action) => (
              <tr key={action.id} className={table.tr}>
                <th scope="row" className={cn(table.td, "min-w-40 font-medium text-foreground")}>
                  {action.name}
                </th>
                <td className={cn(table.td, "min-w-64 text-muted-foreground")}>{action.mechanism}</td>
                <td className={cn(table.td, "min-w-52 text-muted-foreground")}>{action.caution}</td>
                <td className={cn(table.td, "text-right whitespace-nowrap")}>
                  {action.agentKg ? (
                    <>
                      <span className="numeric text-foreground">{action.agentKg.value} kg</span>
                      <span className="mt-1 block">
                        <EvidenceTag kind={evidenceClass(action.agentKg)} />
                      </span>
                    </>
                  ) : (
                    <span className="text-text-tertiary">None</span>
                  )}
                </td>
                <td className={table.td}>
                  <span className="flex flex-wrap gap-1.5">
                    {action.sources.map((id) => (
                      <Cite key={id} id={id} compact />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function NotCovered({ group }: { group: ControlGroupId }) {
  const gaps = partialGravityGaps(group);
  if (!gaps.length) {
    return (
      <Note title="Partial gravity.">
        Lunar and Martian gravity tests are indexed for these topics, but only for short durations.{" "}
        <TextLink href={ROUTES.gaps}>See the evidence gaps</TextLink>
      </Note>
    );
  }
  const topics = [...new Set(gaps.map((gap) => TOPICS[gap.topic].label.toLowerCase()))];
  const regimes = [...new Set(gaps.map((gap) => GRAVITY_REGIMES[gap.gravity].label))];
  return (
    <Note title="Not covered.">
      No test of {topics.join(" or ")} at {regimes.join(" or ")} is indexed here. What is known comes from microgravity and Earth
      gravity, so its use for a surface habitat or rover is an inference. <TextLink href={ROUTES.gaps}>See the evidence gaps</TextLink>
    </Note>
  );
}
