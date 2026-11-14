"use client";

import Image from "next/image";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { AskIgnisButton } from "@/components/ai/scenario-assistant";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { ConditionControls } from "@/components/dashboard/controls";
import { ScoreDisclaimer } from "@/components/design/marks";
import { JOURNEYS } from "@/data/missions";
import { VERIFIED_CITATIONS, VERIFIED_INDEX } from "@/data/verified";
import { useAnalysis } from "@/hooks/use-analysis";
import { formatAir, formatCoverage, formatGravity, formatNumber, formatOxygen, formatPsi, formatWhen } from "@/lib/format";
import { OBJECTIVE_LABEL } from "@/lib/labels";
import { oxygenPartialPressurePsi } from "@/lib/physics/atmosphere";
import { getServices } from "@/services";
import { useMissionStore } from "@/stores/mission-store";
import type { MissionId } from "@/types/domain";
import "./mission-overview.css";

const HABITAT_PREVIEWS: Array<{ id: MissionId; name: string; image: string; alt: string; gravity: string; caption: string; credit: string }> = [
  { id: "lunar-habitat", name: "Moon", image: "moon-exterior", credit: "Foster + Partners / ESA-inspired concept", gravity: "0.165 g", alt: "FireTwin exterior of the conceptual Moon habitat with its protective shell.", caption: "A lunar surface habitat beneath a protective shell. Open FireTwin to explore its rooms, equipment and linked research." },
  { id: "mars-habitat", name: "Mars", image: "mars-exterior", credit: "AI SpaceFactory MARSHA-inspired concept", gravity: "0.38 g", alt: "FireTwin exterior of the MARSHA-inspired conceptual Mars habitat.", caption: "A four-floor habitat on the Martian surface. Open FireTwin to inspect its interior systems and linked research." },
  { id: "gateway-orbit", name: "Gateway", image: "gateway", credit: "NASA-derived exterior / conceptual interiors", gravity: "~0 g", alt: "FireTwin exterior of the Gateway-inspired orbital habitat with its solar arrays extended.", caption: "A habitat in lunar orbit. Inspect conceptual module interiors in a microgravity environment." },
];

const QUESTIONS = [
  {
    title: "Which studies relate to lunar cabin materials?",
    topic: "Material flammability",
    description: "Start with solid polymers in an oxygen-enriched lunar cabin. Follow material-storage equipment to combustion investigations and compare their reported conditions.",
    steps: ["Locate material storage in FireTwin", "Inspect BASS-family research and condition matches"],
    destination: "FireTwin",
    note: "A relevant study is a starting point for review; its results do not automatically transfer to lunar gravity.",
  },
  {
    title: "How can smoke be detected in microgravity?",
    topic: "Smoke detection",
    description: "Use an ISS-like cabin scenario to explore smoke-detection research. Compare SAME- and DAFT-family dossiers and see which conditions are reported or missing.",
    steps: ["Load a microgravity smoke-detection scenario", "Compare investigations in the Research Explorer"],
    destination: "Research",
    note: "The numerical runs in these example dossiers are synthetic. Use the linked NASA records to investigate the underlying literature.",
  },
  {
    title: "Where is Martian-gravity evidence missing?",
    topic: "Research gaps",
    description: "Set the question at 0.38 g. Examine the represented condition space in GravityBridge, then use a gap to frame a possible follow-up study in FireLab.",
    steps: ["Inspect the partial-gravity band in GravityBridge", "Turn an evidence gap into a research question"],
    destination: "GravityBridge",
    note: "An empty cell means this catalog has no matching representation. It does not establish that no study exists.",
  },
];

const WORKFLOW = [
  { number: "01", title: "Locate a system", text: "Explore habitat rooms and equipment in FireTwin.", href: "/firetwin" },
  { number: "02", title: "Inspect the evidence", text: "Read NASA records and compare study conditions.", href: "/research" },
  { number: "03", title: "Find the open questions", text: "Examine coverage and identify research gaps.", href: "/gravity-bridge" },
];

export function MissionOverview() {
  const [previewIndex, setPreviewIndex] = useState(() => HABITAT_PREVIEWS.findIndex((habitat) => habitat.id === "gateway-orbit"));
  const [questionIndex, setQuestionIndex] = useState(0);
  const scenario = useMissionStore((state) => state.scenario);
  const activity = useMissionStore((state) => state.activity);
  const applyJourney = useMissionStore((state) => state.applyJourney);
  const selectMission = useMissionStore((state) => state.selectMission);
  const analysis = useAnalysis();
  const router = useRouter();
  const catalog = getServices().evidence;
  const preview = HABITAT_PREVIEWS[previewIndex];
  const question = QUESTIONS[questionIndex];
  const journey = JOURNEYS[questionIndex];

  return (
    <div className="ignis-overview">
      <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded border border-border bg-card p-5" aria-label="Start here"><div><p className="text-xs text-ember-text">EXPLORE FIRE IN FREEFALL</p><h1 className="mt-1 text-xl font-medium">Choose a habitat. See how a fire behaves.</h1><p className="mt-2 text-sm text-muted-foreground">Set up a scenario, watch the physics, try a response and follow the NASA evidence.</p></div><div className="flex flex-wrap gap-3"><Link href="/firetwin" onClick={()=>useFireSimStore.getState().setOpen(true)} className="inline-flex min-h-10 items-center rounded bg-primary px-4 text-sm font-medium text-primary-foreground">Start a fire scenario →</Link><AskIgnisButton /></div></section>
      <header className="ignis-overview-hero">
        <figure className="ignis-overview-habitatFigure">
          <div id="habitat-preview" data-habitat={preview.image} className="ignis-overview-previewImage">
            <Image
              src={`/overview/${preview.image}.jpg`}
              alt={preview.alt}
              fill
              sizes="(min-width: 1280px) calc(100vw - 220px), (min-width: 768px) calc(100vw - 52px), 100vw"
              loading="eager"
              fetchPriority="high"
            />
          </div>
          <div className="ignis-overview-figureBar">
            <span className="ignis-overview-figureLabel">Habitat preview</span>
            <div className="ignis-overview-previewOptions" role="group" aria-label="Preview a habitat">
              {HABITAT_PREVIEWS.map((habitat, index) => (
                <button key={habitat.id} type="button" aria-pressed={index === previewIndex} aria-controls="habitat-preview" onClick={() => setPreviewIndex(index)}>{habitat.name}</button>
              ))}
            </div>
          </div>
          <figcaption className="ignis-overview-figureCaption">
            <div className="ignis-overview-figureMeta">
              <span className="ignis-overview-imageIndex">Fig. 0{previewIndex + 1} / {preview.name}</span>
              <span className="ignis-overview-gravityLabel">{preview.gravity}</span>
            </div>
            <p>{preview.caption}</p>
            <button type="button" onClick={() => { selectMission(preview.id); router.push("/firetwin"); }} aria-label={`Open ${preview.name} habitat in FireTwin`}>
              Open habitat <ArrowUpRight size={15} aria-hidden="true" />
            </button>
            <span className="ignis-overview-figureNote">FireTwin capture ? {preview.credit}</span>
          </figcaption>
        </figure>
        <div className="ignis-overview-introduction">
          <p className="ignis-overview-eyebrow">IGNIS / Space fire safety research</p>
          <h1>Fire safety<br />beyond Earth.</h1>
          <p className="ignis-overview-lead">Explore space habitats, trace equipment to NASA combustion research, and find the evidence gaps.</p>
          <div className="ignis-overview-actions">
            <button type="button" className="ignis-overview-primaryLink" onClick={() => { selectMission(preview.id); router.push("/firetwin"); }}>Explore FireTwin <ArrowRight size={16} aria-hidden="true" /></button>
            <Link href="/research" className="ignis-overview-secondaryLink">Browse research <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
          <p className="ignis-overview-audience">A research workspace for students, researchers and mission-design discussions.</p>
        </div>
      </header>

      <div className="ignis-overview-body">
      <nav className="ignis-overview-workflow" aria-label="How IGNIS works">
        {WORKFLOW.map((step) => (
          <Link key={step.number} href={step.href} className="ignis-overview-workflowStep">
            <span className="ignis-overview-stepNumber">{step.number}</span>
            <span><strong>{step.title}</strong><span>{step.text}</span></span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <section className="ignis-overview-questionSection" aria-labelledby="questions-heading">
        <div className="ignis-overview-sectionHeading">
          <div><p className="ignis-overview-eyebrow">A place to begin</p><h2 id="questions-heading">Start with a research question.</h2></div>
          <p>Choose an example to preview its approach.</p>
        </div>
        <div className="ignis-overview-questionWorkspace">
          <fieldset className="ignis-overview-questionOptions">
            <legend className="sr-only">Example research question</legend>
            {QUESTIONS.map((item, index) => (
              <label key={item.topic} className="ignis-overview-questionOption">
                <input type="radio" name="research-question" value={index} checked={questionIndex === index} onChange={() => setQuestionIndex(index)} aria-controls="question-preview" />
                <span className="ignis-overview-questionNumber">0{index + 1}</span>
                <span><span className="ignis-overview-questionTopic">{item.topic}</span><span className="ignis-overview-questionTitle">{item.title}</span></span>
                <ArrowRight size={16} aria-hidden="true" />
              </label>
            ))}
          </fieldset>
          <div id="question-preview" className="ignis-overview-questionDetail">
            <div aria-live="polite" aria-atomic="true">
              <p className="ignis-overview-eyebrow">Example 0{questionIndex + 1} / {journey.scenario.name}</p>
              <h3>{question.title}</h3>
              <p className="ignis-overview-questionDescription">{question.description}</p>
              <dl className="ignis-overview-exampleConditions" aria-label="Example cabin conditions">
                <div><dt>Gravity</dt><dd>{formatGravity(journey.scenario.gravityG)} g</dd></div>
                <div><dt>Oxygen</dt><dd>{formatOxygen(journey.scenario.oxygenPct)}%</dd></div>
                <div><dt>Cabin pressure</dt><dd>{formatPsi(journey.scenario.pressurePsi)} psi</dd></div>
              </dl>
              <ol className="ignis-overview-exampleSteps">{question.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              <p className="ignis-overview-researchNote">{question.note}</p>
            </div>
            <div className="ignis-overview-launchExample">
              <button type="button" className="ignis-overview-primaryLink" onClick={() => { applyJourney(journey.id); router.push(journey.route); }}>Open {question.destination} workflow <ArrowRight size={16} aria-hidden="true" /></button>
              <p>Loads this example’s cabin conditions into your workspace.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ignis-overview-evidenceSection" aria-labelledby="evidence-heading">
        <div className="ignis-overview-evidenceIntro">
          <p className="ignis-overview-eyebrow">Evidence &amp; provenance</p>
          <h2 id="evidence-heading">Know what you’re looking at.</h2>
          <p>IGNIS brings together a small index of NASA literature and a separate demonstration dataset. Their roles are different.</p>
          <Link href="/research" className="ignis-overview-textLink">Inspect the research catalog <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        <div className="ignis-overview-sourceLedger">
          <div className="ignis-overview-sourceRow">
            <span className="ignis-overview-sourceCount">{VERIFIED_CITATIONS.length}</span>
            <div><h3>NASA citation records <span className="ignis-overview-sourceTag">Verified metadata</span></h3><p>Titles, authors, abstracts and links from NTRS. Experimental measurements have not been extracted.</p></div>
          </div>
          <div className="ignis-overview-sourceRow">
            <span className="ignis-overview-sourceCount">{catalog.listInvestigations().length}</span>
            <div><h3>Investigation dossiers <span className="ignis-overview-demoTag">Synthetic</span></h3><p>{catalog.listRuns().length} fictional runs demonstrate comparison, ranking and coverage. They are not NASA experimental results.</p></div>
          </div>
          <p className="ignis-overview-provenanceNote">NTRS index retrieved {VERIFIED_INDEX.retrievedAt}. PSI is a repository reference; its dataset files have not been ingested.</p>
        </div>
      </section>

      <details className="ignis-overview-scienceNote">
        <summary><span>Why compare gravity, oxygen, pressure and airflow?</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div><p>Changes in gravity and airflow affect fire behavior. Oxygen concentration and cabin pressure also affect how materials burn. A study’s conditions matter when considering its relevance to a different habitat.</p><a className="ignis-overview-textLink" href="https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-008-fire-protection.pdf" target="_blank" rel="noreferrer">NASA technical brief: Fire Protection <ArrowUpRight size={14} aria-hidden="true" /></a></div>
      </details>

      <section className="ignis-overview-furtherTools" aria-label="Continue your investigation">
        <Link href="/predict"><span>Predict <ArrowUpRight size={15} aria-hidden="true" /></span><p>Inspect a synthetic trend demonstration and the limits of prediction.</p></Link>
        <Link href="/firelab"><span>FireLab <ArrowUpRight size={15} aria-hidden="true" /></span><p>Build an evidence briefing and draft follow-up research questions.</p></Link>
        <Link href="/reports"><span>Reports <ArrowUpRight size={15} aria-hidden="true" /></span><p>Review your scenario, save it locally and export a research summary.</p></Link>
      </section>

      <section className="ignis-overview-currentWorkspace" aria-labelledby="workspace-heading">
        <div className="ignis-overview-workspaceHeading"><div><p className="ignis-overview-eyebrow">Your current workspace</p><h2 id="workspace-heading">{scenario.name}</h2></div><span className="ignis-overview-workspaceObjective">{OBJECTIVE_LABEL[scenario.objective]}</span></div>
        <dl className="ignis-overview-currentConditions" aria-label="Current cabin conditions">
          <div><dt>Gravity</dt><dd>{formatGravity(scenario.gravityG)} g</dd></div>
          <div><dt>Oxygen</dt><dd>{formatOxygen(scenario.oxygenPct)}%</dd></div>
          <div><dt>Cabin pressure</dt><dd>{formatPsi(scenario.pressurePsi)} psi</dd></div>
          <div><dt>Oxygen partial pressure</dt><dd>{formatNumber(oxygenPartialPressurePsi(scenario.oxygenPct, scenario.pressurePsi), 2)} psi</dd></div>
          <div><dt>Airflow</dt><dd>{formatAir(scenario.airflowMs)} m/s</dd></div>
        </dl>
        <details className="ignis-overview-scenarioDetails">
          <summary><span>Adjust scenario &amp; inspect catalog coverage</span><ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="ignis-overview-scenarioPanel">
            <div><h3>Cabin conditions</h3><p className="ignis-overview-panelDescription">These inputs are shared across the research tools.</p><ConditionControls /></div>
            <div><h3>Catalog coverage</h3>{analysis.dataMode === "verified" ? <p className="ignis-overview-panelDescription">Verified mode contains citation metadata only. Numerical coverage is unavailable because measurements have not been extracted.</p> : <><p className="ignis-overview-panelDescription">Heuristic summaries of the synthetic demonstration dataset.</p><dl className="ignis-overview-metrics"><div><dt>Relevant demo dossiers</dt><dd>{analysis.relevantCount}</dd></div><div><dt>Condition-space coverage</dt><dd>{formatCoverage(analysis.coverage.percent)}</dd></div><div><dt>Catalog gaps</dt><dd>{analysis.gaps.length}</dd></div></dl><ScoreDisclaimer kind="coverage" /></>}
            <details className="ignis-overview-activity"><summary>Session activity <ChevronDown size={14} aria-hidden="true" /></summary><ol>{activity.map((item) => <li key={item.id}><span>{item.label}</span><time>{formatWhen(item.at)}</time></li>)}</ol></details></div>
          </div>
        </details>
      </section>

      <footer className="ignis-overview-footer">
        <p>A research and education prototype. Conceptual habitats and numerical demonstrations do not establish flight safety.</p>
        <div><a href="https://ntrs.nasa.gov/" target="_blank" rel="noreferrer">NASA NTRS <ArrowUpRight size={13} aria-hidden="true" /></a><a href="https://psi.nasa.gov/physci/repo/" target="_blank" rel="noreferrer">NASA PSI <ArrowUpRight size={13} aria-hidden="true" /></a></div>
      </footer>
      </div>
    </div>
  );
}
