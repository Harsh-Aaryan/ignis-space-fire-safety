"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Flame } from "lucide-react";
import { ActionLink, ExternalLink, SectionHeading, Tag, TextLink } from "@/components/design/kit";
import { FIRE_MATERIALS } from "@/data/fire/materials";
import {
  CREW_ENVIRONMENTS,
  INVESTIGATIONS,
  KIND_LABEL,
  PILLARS,
  RESEARCH_INDEX_SUMMARY,
  investigationById,
  investigationsForEnvironment,
  investigationsForPillar,
  type CrewEnvironment,
  type Pillar,
} from "@/data/research/investigations";
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
}> = [
  {
    id: "lunar-habitat",
    name: "Moon",
    image: "moon-exterior",
    gravity: "0.165 g",
    alt: "Rendered exterior of the conceptual Moon habitat beneath its protective shell.",
    caption: "A lunar surface habitat beneath a protective shell. Open it to walk its rooms and set a fire scenario at lunar gravity.",
    credit: "Conceptual habitat after Foster + Partners / ESA",
  },
  {
    id: "mars-habitat",
    name: "Mars",
    image: "mars-exterior",
    gravity: "0.38 g",
    alt: "Rendered exterior of the conceptual four-floor Mars habitat.",
    caption: "A four-floor habitat on the Martian surface. Open it to inspect its interior systems at Martian gravity.",
    credit: "Conceptual habitat after AI SpaceFactory MARSHA",
  },
  {
    id: "gateway-orbit",
    name: "Gateway",
    image: "gateway",
    gravity: "about 0 g",
    alt: "Rendered exterior of the Gateway-inspired orbital habitat with its solar arrays extended.",
    caption: "A station in lunar orbit. Open it to inspect conceptual module interiors in microgravity.",
    credit: "Exterior after NASA Gateway; interiors are conceptual",
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

/* ------------------------------------------------------------------ */
/* Findings: text is read from the research index by position.         */
/* `text` overrides only shorten or normalize units of that sentence.  */
/* ------------------------------------------------------------------ */

const FINDINGS: Array<{ id: string; finding: number; implication: number; text?: string }> = [
  {
    id: "bass-ii",
    finding: 0,
    implication: 0,
    text: "An acrylic rod spread flame steadily at 13.6% O₂ in microgravity, although it blows off at 16% O₂ in Earth gravity.",
  },
  { id: "saffire-vi", finding: 1, implication: 0 },
  {
    id: "saffire-iv-v",
    finding: 1,
    implication: 0,
    text: "Thick samples kept burning after the flow was reduced, so extinguishment of thick or charring fuels cannot be assumed to be rapid.",
  },
  { id: "lunar-martian-flammability", finding: 2, implication: 0 },
];

const ENVIRONMENT_ORDER: CrewEnvironment[] = ["spacecraft", "station", "lunar-base", "mars-base", "rover"];

/* ------------------------------------------------------------------ */

export function MissionOverview() {
  return (
    <div className="flex flex-col gap-16 md:gap-20">
      <Hero />
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-16 px-4 pb-8 md:gap-20 md:px-6 xl:px-10">
        <ResearchQuestions />
        <Findings />
        <Environments />
        <OverviewFooter />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section aria-labelledby="overview-title" className="overview-hero">
      <HabitatPreview>
        <div className="overview-copy">
          <p className="micro text-muted-foreground">Spacecraft fire safety research</p>
          <h1
            id="overview-title"
            className="mt-3 text-[36px] leading-10 font-normal text-foreground md:text-[44px] md:leading-[48px] md:tracking-[-0.02em]"
          >
            Fire behaves differently off Earth
          </h1>
          <p className="mt-4 text-[16px] leading-7 text-muted-foreground md:text-[18px]">
            Explore NASA&apos;s flight fire experiments and model a fire inside a crewed habitat. Compare microgravity, Moon and Mars scenarios,
            and see where the evidence stops.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ActionLink href={ROUTES.simulation} variant="primary" onClick={() => useFireSimStore.getState().setOpen(true)}>
              <Flame className="size-4" aria-hidden="true" />
              Run a fire scenario
            </ActionLink>
            <ActionLink href={ROUTES.research}>Browse the research</ActionLink>
          </div>
        </div>
      </HabitatPreview>
    </section>
  );
}

function HabitatPreview({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = useState(() => HABITAT_PREVIEWS.findIndex((habitat) => habitat.id === "gateway-orbit"));
  const selectMission = useMissionStore((state) => state.selectMission);
  const preview = HABITAT_PREVIEWS[index];

  return (
    <figure className="overview-scene">
      <div className="overview-content">{children}</div>
      <div id="habitat-preview" data-habitat={preview.image} className="overview-render">
        <Image
          src={`/overview/${preview.image}.jpg`}
          alt={preview.alt}
          fill
          quality={90}
          className="overview-image"
          sizes="(min-width: 1280px) calc(100vw - 240px), (min-width: 768px) calc(100vw - 64px), 100vw"
          loading="eager"
          fetchPriority="high"
        />
      </div>
      <div aria-hidden="true" className="overview-shade" />
      <figcaption className="overview-caption">
        <div className="overview-controls">
          <div role="group" aria-label="Preview a habitat" className="flex rounded-md border border-border-subtle bg-background p-0.5">
            {HABITAT_PREVIEWS.map((habitat, i) => {
              const active = i === index;
              return (
                <button
                  key={habitat.id}
                  type="button"
                  aria-pressed={active}
                  aria-controls="habitat-preview"
                  onClick={() => setIndex(i)}
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
            onClick={() => selectMission(preview.id)}
            aria-label={`Open the ${preview.name} habitat in the simulation`}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm text-ember-text underline-offset-4 hover:underline"
          >
            Open habitat
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <p className={cn("overview-description", "text-sm leading-6 text-muted-foreground")} aria-live="polite">
          {preview.caption}
        </p>
        <p className={cn("overview-credit", "text-[12px] leading-4 text-text-tertiary")}>{preview.credit}</p>
      </figcaption>
    </figure>
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

function Findings() {
  const items = FINDINGS.flatMap((entry) => {
    const record = investigationById(entry.id);
    if (!record) return [];
    return [
      {
        record,
        text: entry.text ?? record.findings[entry.finding]?.text ?? "",
        implication: record.controlsUse[entry.implication] ?? null,
      },
    ];
  });

  return (
    <section aria-labelledby="findings-heading">
      <SectionHeading
        id="findings-heading"
        title="What the experiments show"
        description="Four findings from the research index, with links to the records and their implications for fire safety"
        className="mb-6"
      />
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map(({ record, text, implication }) => (
          <li key={record.id} className="flex flex-col rounded-lg border border-border-subtle bg-card p-6">
            <p className="text-[15px] leading-6 text-foreground">{text}</p>
            {implication ? (
              <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
                <span className="text-foreground">Why it matters. </span>
                {implication}
              </p>
            ) : null}
            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-5">
              <TextLink href={ROUTES.investigation(record.id)} className="text-sm font-medium">
                {record.name}
              </TextLink>
              <Tag>{KIND_LABEL[record.kind]}</Tag>
              <span className="text-[12px] leading-4 text-text-tertiary">{record.period}</span>
            </div>
          </li>
        ))}
      </ul>
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
                  <span className="numeric text-[13px] text-ember-text">{env.gravityLabel}</span>
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
