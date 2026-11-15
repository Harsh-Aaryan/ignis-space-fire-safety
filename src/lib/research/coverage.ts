import {
  GRAVITY_REGIMES,
  INVESTIGATIONS,
  MATRIX_TOPICS,
  coverageCell,
  type GravityRegime,
  type InvestigationRecord,
  type Topic,
} from "@/data/research/investigations";

/** Derived views of the research index: coverage cells and control groups. No scoring. */

export const GRAVITY_ORDER = Object.keys(GRAVITY_REGIMES) as GravityRegime[];

export interface CoverageRow {
  topic: Topic;
  cells: Array<{ gravity: GravityRegime; records: InvestigationRecord[] }>;
}

export function coverageMatrix(topics: Topic[] = MATRIX_TOPICS): CoverageRow[] {
  return topics.map((topic) => ({
    topic,
    cells: GRAVITY_ORDER.map((gravity) => ({ gravity, records: coverageCell(topic, gravity) })),
  }));
}

export function emptyCells(topics: Topic[] = MATRIX_TOPICS): Array<{ topic: Topic; gravity: GravityRegime }> {
  return coverageMatrix(topics).flatMap((row) =>
    row.cells.filter((cell) => cell.records.length === 0).map((cell) => ({ topic: row.topic, gravity: cell.gravity })),
  );
}

export function isCellEmpty(topic: Topic, gravity: GravityRegime): boolean {
  return coverageCell(topic, gravity).length === 0;
}

export type ControlGroupId = "detection" | "suppression" | "materials";

export const CONTROL_GROUP_TOPICS: Record<ControlGroupId, Topic[]> = {
  detection: ["detection", "smoke"],
  suppression: ["suppression"],
  materials: ["flammability-limits", "atmosphere-limits"],
};

/** Records with the controls pillar that address a group's topics, in index order. */
export function controlRecords(group: ControlGroupId, records: InvestigationRecord[] = INVESTIGATIONS): InvestigationRecord[] {
  const topics = CONTROL_GROUP_TOPICS[group];
  return records.filter((record) => record.pillars.includes("controls") && record.topics.some((topic) => topics.includes(topic)));
}

/** Partial-gravity cells left empty for a group's topics. */
export function partialGravityGaps(group: ControlGroupId): Array<{ topic: Topic; gravity: GravityRegime }> {
  return CONTROL_GROUP_TOPICS[group]
    .filter((topic) => MATRIX_TOPICS.includes(topic))
    .flatMap((topic) => (["lunar", "mars"] as GravityRegime[]).filter((gravity) => isCellEmpty(topic, gravity)).map((gravity) => ({ topic, gravity })));
}
