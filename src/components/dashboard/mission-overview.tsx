"use client";

import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Flame, Search } from "lucide-react";
import { FeaturedFinding } from "@/components/dashboard/featured-finding";
import { ActionLink, ExternalLink, LINK, SectionHeading, TextLink, actionClass } from "@/components/design/kit";
import { FIRE_MATERIALS } from "@/data/fire/materials";
import { EXAMPLE_QUESTIONS, type ExampleQuestion } from "@/data/research/featured-findings";
import {
  CREW_ENVIRONMENTS,
  INVESTIGATIONS,
  PILLARS,
  RESEARCH_INDEX_SUMMARY,
  investigationsForEnvironment,
  investigationsForPillar,
  type CrewEnvironment,
  type Pillar,
} from "@/data/research/investigations";
import { NO_FILTERS, filtersToQuery } from "@/lib/research/filter";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import type { MissionId } from "@/types/domain";
import "./mission-overview.css";

const PSI_REPO = "https://psi.nasa.gov/physci/repo/";
const NTRS = "https://ntrs.nasa.gov/";

/* ------------------------------------------------------------------ */
/* Habitat renders                                                     */
/* ------------------------------------------------------------------ */

const HABITAT_PREVIEWS: Array<{
  id: MissionId;
  name: string;
  image: string;
  gravity: string;
  alt: string;
  caption: string;
  credit: string;
  /** Where the wide hero crops the render, so the habitat stays in frame. */
  position: string;
}> = [
  {
    id: "lunar-habitat",
    name: "Moon",
    image: "moon-exterior",
    gravity: "0.165 g",
    alt: "Rendered exterior of the conceptual Moon habitat beneath its protective shell.",
    caption: "A lunar surface habitat beneath a protective shell. Open it to walk its rooms and set a fire scenario at lunar gravity.",
    credit: "Conceptual habitat after Foster + Partners / ESA",
    position: "center 18%",
  },
  {
    id: "mars-habitat",
    name: "Mars",
    image: "mars-exterior",
    gravity: "0.38 g",
    alt: "Rendered exterior of the conceptual four-floor Mars habitat.",
    caption: "A four-floor habitat on the Martian surface. Open it to inspect its interior systems at Martian gravity.",
    credit: "Conceptual habitat after AI SpaceFactory MARSHA",
    position: "center 42%",
  },
  {
    id: "gateway-orbit",
    name: "Gateway",
    image: "gateway",
    gravity: "about 0 g",
    alt: "Rendered exterior of the Gateway-inspired orbital habitat with its solar arrays extended.",
    caption: "A station in lunar orbit. Open it to inspect conceptual module interiors in microgravity.",
    credit: "Exterior after NASA Gateway; interiors are conceptual",
    position: "center 52%",
  },
];

/* ------------------------------------------------------------------ */
/* Research questions                                                  */
/* ------------------------------------------------------------------ */

const PILLAR_ORDER: Pillar[] = ["crew-environments", "predictive-modeling", "controls"];

function pillarFacts(pillar: Pillar): { href: string; linkLabel: string; facts: Array<{ value: number; label: string }> } {
  const records = investigationsForPillar(pillar);
  if (pillar === "crew-environments") {
    return {
      href: ROUTES.research,
      linkLabel: "See the investigations",
      facts: [
        { value: records.length, label: "indexed records" },
        { value: Object.keys(CREW_ENVIRONMENTS).length, label: "crew environments mapped" },
      ],
    };
  }
  if (pillar === "predictive-modeling") {
    return {
      href: ROUTES.modelingData,
      linkLabel: "See the modeling data",
      facts: [
        { value: RESEARCH_INDEX_SUMMARY.psiTables, label: "NASA experiment tables" },
        { value: FIRE_MATERIALS.length, label: "material profiles in the model" },
      ],
    };
  }
  return {
    href: ROUTES.controls,
    linkLabel: "See detection and suppression",
    facts: [
      { value: records.length, label: "indexed records" },
      { value: records.filter((item) => item.kind === "flight-system").length, label: "flight systems" },
      { value: records.filter((item) => item.kind === "standard").length, label: "NASA standards" },
    ],
  };
}

/** Investigations opened with the filters an example question names. */
function exampleHref(question: ExampleQuestion): string {
  const query = filtersToQuery({
    ...NO_FILTERS,
    environment: question.environment ?? null,
    topic: question.topic ?? null,
    gravity: question.gravity ?? null,
    query: question.query ?? "",
  });
  return query ? `${ROUTES.research}?${query}` : ROUTES.research;
}

const ENVIRONMENT_ORDER: CrewEnvironment[] = ["spacecraft", "station", "lunar-base", "mars-base", "rover"];

/* ------------------------------------------------------------------ */

export function MissionOverview() {
  return (
    <div className="flex flex-col">
      <Hero />
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-16 px-4 pt-8 pb-8 md:gap-20 md:px-6 xl:px-10">
        <StartFromEvidence />
        <ResearchQuestions />
        <Environments />
        <OverviewFooter />
      </div>
    </div>
  );
}

/**
 * The opening screen: the habitat render fills the hero edge to edge, and what IGNIS is
 * and the two ways in sit on its calm side. The selection is the shared mission in the
 * store, so the scene always matches the habitat switcher in the top bar. The store hook
 * renders the unhydrated default on the server and during hydration, then the session's
 * saved habitat, so the markup never disagrees with the server's.
 */
function Hero() {
  const missionId = useMissionStore((state) => state.scenario.missionId);
  const selectMission = useMissionStore((state) => state.selectMission);
  const preview = HABITAT_PREVIEWS.find((habitat) => habitat.id === missionId) ?? HABITAT_PREVIEWS[0];
  const choose = (id: MissionId) => {
    if (id !== missionId) selectMission(id);
  };

  return (
    <section aria-labelledby="overview-title" className="overview-hero">
      <div id="habitat-preview" data-habitat={preview.image} className="overview-scene">
        <div className="overview-frame">
          <Image
            src={`/overview/${preview.image}.jpg`}
            alt={preview.alt}
            fill
            quality={90}
            sizes="(min-width: 1024px) 75vw, 100vw"
            preload
            className="overview-image"
            style={{ objectPosition: preview.position }}
          />
        </div>
        <div className="overview-shade" aria-hidden="true" />
      </div>

      <div className="overview-content">
        <div className="overview-intro">
          <h1
            id="overview-title"
            className="text-[32px] leading-10 font-normal text-foreground md:text-[44px] md:leading-[52px] md:tracking-[-0.02em]"
          >
            Fire behaves differently off Earth
          </h1>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-6 text-foreground/80 md:mt-4 md:text-[17px] md:leading-7">
            IGNIS indexes NASA&apos;s fire-safety investigations by the crew environments they bear on, and models a fire inside a Moon, Mars
            or orbital habitat.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 md:mt-8">
            <ActionLink href={ROUTES.simulation} variant="primary" onClick={() => useFireSimStore.getState().setOpen(true)}>
              <Flame className="size-4" aria-hidden="true" />
              Run a fire scenario
            </ActionLink>
            <ActionLink href={ROUTES.research} className="bg-background/70 hover:bg-elev-3">
              Browse the research
            </ActionLink>
          </div>
        </div>

        <div className="overview-caption">
          <div className="min-w-0 max-w-[52ch]">
            <p className="text-[13px] leading-5 text-foreground/80" aria-live="polite">
              {preview.caption}
            </p>
            <p className="mt-1 text-[12px] leading-4 text-muted-foreground">{preview.credit}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div role="group" aria-label="Preview a habitat" className="flex rounded-md border border-border-subtle bg-background/85 p-0.5">
              {HABITAT_PREVIEWS.map((habitat) => {
                const active = habitat.id === preview.id;
                return (
                  <button
                    key={habitat.id}
                    type="button"
                    aria-pressed={active}
                    aria-controls="habitat-preview"
                    onClick={() => choose(habitat.id)}
                    className={cn(
                      "min-h-11 rounded-sm px-3 text-left text-[13px] leading-4 transition-colors",
                      active ? "bg-elev-3 text-foreground" : "text-muted-foreground hover:bg-elev-2 hover:text-foreground",
                    )}
                  >
                    <span className="block">{habitat.name}</span>
                    <span className="numeric block text-[12px] text-text-tertiary">{habitat.gravity}</span>
                  </button>
                );
              })}
            </div>
            <Link
              href={ROUTES.simulation}
              onClick={() => choose(preview.id)}
              aria-label={`Open the ${preview.name} habitat in the simulation`}
              className={cn(LINK, "min-h-10 gap-1.5 text-sm")}
            >
              Open habitat
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Directly under the hero: one sourced finding, and a research question to start from. */
function StartFromEvidence() {
  return (
    <section aria-label="Start from the evidence" className="overview-evidence">
      <FeaturedFinding />
      <ResearchQuestionBox />
    </section>
  );
}

/** A question opens the investigations with it as the search text. */
function ResearchQuestionBox() {
  return (
    <Form
      action={ROUTES.research}
      role="search"
      aria-label="Search the investigations"
      className="flex flex-col rounded-lg border border-border-subtle bg-card p-4 md:p-5"
    >
      <label htmlFor="overview-question" className="block text-[15px] leading-6 font-medium text-foreground">
        Start from a research question
      </label>
      <div className="mt-3 flex gap-2">
        <input
          id="overview-question"
          name="q"
          type="search"
          required
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Smoke detector placement in microgravity"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[14px] text-foreground transition-colors placeholder:text-text-tertiary hover:border-input"
        />
        <button type="submit" className={cn(actionClass("secondary"), "shrink-0 px-3 sm:px-4")}>
          <Search className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Search</span>
        </button>
      </div>
      <p className="mt-5 text-[12px] leading-4 text-text-tertiary">For example</p>
      <ul className="mt-1">
        {EXAMPLE_QUESTIONS.map((question) => (
          <li key={question.label} className="border-b border-border-subtle last:border-b-0">
            <Link
              href={exampleHref(question)}
              className="flex min-h-11 items-center justify-between gap-3 text-[14px] leading-5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {question.label}
              <ArrowRight className="size-4 shrink-0 text-text-tertiary" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Form>
  );
}

function ResearchQuestions() {
  return (
    <section aria-labelledby="questions-heading">
      <SectionHeading
        id="questions-heading"
        title="Three questions the research has to answer"
        description="IGNIS is organized around the questions the challenge asks of NASA's fire safety research. Each one has its own view of the evidence."
        className="mb-6"
      />
      <ol className="grid gap-4 md:grid-cols-3">
        {PILLAR_ORDER.map((pillar, i) => {
          const info = PILLARS[pillar];
          const { href, linkLabel, facts } = pillarFacts(pillar);
          return (
            <li key={pillar} className="flex flex-col rounded-lg border border-border-subtle bg-card p-6">
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <span className="numeric flex size-6 items-center justify-center rounded-sm border border-border-subtle text-[12px] text-muted-foreground">
                  {i + 1}
                </span>
                {info.label}
              </p>
              <h3 className="mt-4 text-[16px] leading-6 font-medium text-foreground">{info.question}</h3>
              <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-border-subtle pt-4">
                {facts.map((fact) => (
                  <div key={fact.label} className="min-w-0">
                    <dt className="sr-only">{fact.label}</dt>
                    <dd className="numeric text-[20px] leading-7 text-foreground">{fact.value}</dd>
                    <dd aria-hidden="true" className="text-[12px] leading-4 text-muted-foreground">
                      {fact.label}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto pt-5">
                <TextLink href={href} className="text-sm">
                  {linkLabel}
                </TextLink>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Environments() {
  return (
    <section aria-labelledby="environments-heading">
      <SectionHeading
        id="environments-heading"
        title="Where crews will live"
        description={
          <>
            For each environment: how many indexed records tested its conditions, how many apply there directly, and how many inform it
            with a stated caveat. Of {INVESTIGATIONS.length} records, most were measured in microgravity or Earth gravity.
          </>
        }
        actions={
          <TextLink href={ROUTES.research} className="text-sm">
            Browse the investigations
          </TextLink>
        }
        className="mb-6"
      />
      <ul className="overflow-hidden rounded-lg border border-border-subtle bg-card">
        {ENVIRONMENT_ORDER.map((id) => {
          const env = CREW_ENVIRONMENTS[id];
          const tested = investigationsForEnvironment(id, "tested").length;
          const applies = investigationsForEnvironment(id, "applies").length;
          const transferable = investigationsForEnvironment(id, "transferable").length;
          return (
            <li
              key={id}
              className="grid gap-x-8 gap-y-3 border-b border-border-subtle px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[15px] font-medium text-foreground">{env.label}</span>
                  <span className="numeric text-[13px] text-muted-foreground">{env.gravityLabel}</span>
                </p>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{env.note}</p>
              </div>
              <dl className="grid grid-cols-3 gap-6 md:w-[300px]">
                <EnvCount value={tested} label="tested here" emphasis />
                <EnvCount value={applies} label="apply directly" />
                <EnvCount value={transferable} label="transferable" />
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EnvCount({ value, label, emphasis = false }: { value: number; label: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="sr-only">{label}</dt>
      <dd className={cn("numeric text-[18px] leading-6", emphasis ? "text-foreground" : "text-muted-foreground")}>{value}</dd>
      <dd aria-hidden="true" className="text-[12px] leading-4 text-text-tertiary">
        {label}
      </dd>
    </div>
  );
}

function OverviewFooter() {
  return (
    <footer className="flex flex-col gap-3 border-t border-border-subtle pt-6 pb-2 text-[13px] leading-5 text-muted-foreground md:flex-row md:items-center md:justify-between">
      <p className="max-w-2xl">
        IGNIS is a research and education tool. It does not certify materials, hardware or procedures.
      </p>
      <p className="flex flex-wrap gap-x-5 gap-y-2">
        <ExternalLink href={PSI_REPO}>NASA Physical Sciences Informatics</ExternalLink>
        <ExternalLink href={NTRS}>NASA Technical Reports Server</ExternalLink>
      </p>
    </footer>
  );
}
