import { describe, expect, it } from "vitest";
import { FIRE_SOURCES } from "@/data/fire/sources";
import {
  EXAMPLE_QUESTIONS,
  FEATURED_FINDINGS,
  featuredFindings,
  primaryLinks,
  resolveFeaturedFinding,
} from "@/data/research/featured-findings";
import { INVESTIGATIONS, investigationById, ntrsUrl, psiUrl } from "@/data/research/investigations";
import { NO_FILTERS, filterInvestigations, filtersFromQuery, filtersToQuery } from "@/lib/research/filter";

describe("featured findings", () => {
  it("curates two or three distinct findings", () => {
    expect(FEATURED_FINDINGS.length).toBeGreaterThanOrEqual(2);
    expect(FEATURED_FINDINGS.length).toBeLessThanOrEqual(3);
    const keys = FEATURED_FINDINGS.map((ref) => `${ref.recordId}#${ref.finding}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(FEATURED_FINDINGS.map((ref) => [ref.recordId, ref] as const))("%s resolves to its record, finding, implication and source", (_, ref) => {
    const record = investigationById(ref.recordId);
    expect(record, `record ${ref.recordId}`).not.toBeNull();
    const finding = record!.findings[ref.finding];
    expect(finding, `finding ${ref.finding} of ${ref.recordId}`).toBeDefined();
    const implication = record![ref.implication.field][ref.implication.index];
    expect(implication, `${ref.implication.field}[${ref.implication.index}] of ${ref.recordId}`).toBeTruthy();

    // The finding was read out of a registered source document.
    expect(finding.sourceId, `finding ${ref.finding} of ${ref.recordId} names its source`).toBeTruthy();
    const source = FIRE_SOURCES.find((item) => item.id === finding.sourceId);
    expect(source, `source ${finding.sourceId}`).toBeDefined();
    expect(record!.links.sources).toContain(finding.sourceId);

    const resolved = resolveFeaturedFinding(ref);
    expect(resolved).not.toBeNull();
    // The page shows the record's own text, unchanged.
    expect(resolved!.finding.text).toBe(finding.text);
    expect(resolved!.implication).toBe(implication);
    expect(resolved!.source?.id).toBe(source!.id);

    // Links are the record's NASA identifiers, and the first is the source document itself.
    expect(resolved!.links.length).toBeGreaterThan(0);
    const expected = [...record!.links.ntrs.map(ntrsUrl), ...record!.links.psi.map(psiUrl)].sort();
    expect(resolved!.links.map((link) => link.href).sort()).toEqual(expected);
    expect(resolved!.links[0].href).toBe(source!.url);

    // The card shows the cited NTRS record, plus the first NASA experiment table when the record has one.
    const shown = primaryLinks(resolved!.links);
    expect(shown[0].href).toBe(source!.url);
    expect(shown.map((link) => link.href)).toEqual(
      [source!.url, ...record!.links.psi.slice(0, 1).map(psiUrl)].filter((href): href is string => !!href),
    );
  });

  it("drops a pointer that does not resolve", () => {
    expect(resolveFeaturedFinding({ recordId: "not-a-record", finding: 0, implication: { field: "controlsUse", index: 0 } })).toBeNull();
    expect(resolveFeaturedFinding({ recordId: "saffire-vi", finding: 99, implication: { field: "controlsUse", index: 0 } })).toBeNull();
    expect(resolveFeaturedFinding({ recordId: "saffire-vi", finding: 0, implication: { field: "modelUse", index: 99 } })).toBeNull();
    expect(featuredFindings()).toHaveLength(FEATURED_FINDINGS.length);
  });
});

describe("example research questions", () => {
  it.each(EXAMPLE_QUESTIONS.map((question) => [question.label, question] as const))("%s opens matching investigations", (_, question) => {
    const filters = {
      ...NO_FILTERS,
      environment: question.environment ?? null,
      topic: question.topic ?? null,
      gravity: question.gravity ?? null,
      query: question.query ?? "",
    };
    const query = filtersToQuery(filters);
    expect(query).not.toBe("");
    // The URL carries exactly the filters the example names.
    expect(filtersFromQuery(new URLSearchParams(query))).toEqual(filters);
    expect(filterInvestigations(INVESTIGATIONS, filters).length).toBeGreaterThan(0);
  });
});
