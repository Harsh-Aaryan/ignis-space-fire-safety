"use client";

import Link from "next/link";
import { useState } from "react";
import { FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/design/marks";
import { CoverageChart, RelevanceChart } from "@/components/charts/evidence-charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber, formatScore } from "@/lib/format";
import { useAnalysis } from "@/hooks/use-analysis";
import { answerQuestion } from "@/services/assistant";
import { useMissionStore } from "@/stores/mission-store";

const PROMPTS = [
  "Which investigations are most relevant to this habitat?",
  "What research relates to smoke detection?",
  "Which conditions best match our atmosphere?",
  "What evidence is missing for Martian gravity?",
  "What should researchers investigate next?",
];

export function FireLabView() {
  const analysis = useAnalysis();
  const scenario = useMissionStore((state) => state.scenario);
  const chat = useMissionStore((state) => state.chat);
  const addChat = useMissionStore((state) => state.addChat);
  const clearChat = useMissionStore((state) => state.clearChat);
  const weights = useMissionStore((state) => state.weights);
  const filters = useMissionStore((state) => state.filters);
  const includeMissing = useMissionStore((state) => state.includeMissingInFilters);
  const assistantDraft = useMissionStore(state => state.assistantDraft);
  const [draft, setDraft] = useState(assistantDraft);
  const [pending, setPending] = useState(false);
  const [pane, setPane] = useState<"briefing" | "recommendations">("briefing");

  function ask(message: string) {
    const text = message.trim();
    if (!text || pending) return;
    const userTurn = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      text,
      at: Date.now(),
    };
    addChat(userTurn);
    setDraft("");
    setPending(true);
    window.setTimeout(() => {
      const reply = answerQuestion(text, scenario, [...chat, userTurn], {
        weights,
        filters,
        includeMissing,
        citations: analysis.citations,
      });
      addChat({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: reply.text,
        at: Date.now(),
        investigationIds: reply.investigationIds,
        chartSuggestion: reply.chartSuggestion,
        uncertainty: reply.uncertainty,
      });
      setPending(false);
    }, 280);
  }

  const briefing = (
    <section className="flex min-h-[24rem] flex-col rounded border border-[#3A3E44] bg-[#1F2125] xl:sticky xl:top-0 xl:max-h-[calc(100dvh-48px-32px)] xl:min-h-[32rem]">
      <header className="border-b border-[#2A2D32] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-cond text-[12px] font-semibold tracking-[0.08em] uppercase">Briefing</h2>
          <StatusChip level="info">Demo AI</StatusChip>
          <button type="button" className="ml-auto text-[13px] text-muted-foreground" onClick={clearChat}>
            Clear briefing
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground italic">
          Demo AI — responses use synthetic research records.
        </p>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
        {chat.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">The clerk answers from the dossiers already ranked for this scenario.</p>
        ) : (
          chat.map((turn) => (
            <div
              key={turn.id}
              className={
                turn.role === "user"
                  ? "ml-auto max-w-[80%] rounded bg-[#36383C] p-2 text-[13px]"
                  : "mr-auto max-w-[80%] rounded border border-[#2A2D32] bg-[#292C30] p-2 text-[13px]"
              }
            >
              <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                {turn.role === "assistant" ? <FileSearch className="size-3.5" strokeWidth={1.5} /> : null}
                {turn.role === "user" ? "You" : "Briefing clerk"}
              </p>
              <p className="leading-6">{turn.text}</p>
              {turn.investigationIds?.map((id) => (
                <Link key={id} href={`/research/${id}`} className="numeric mr-2 text-xs text-ember-text">
                  {id.toUpperCase()}
                </Link>
              ))}
              {turn.chartSuggestion?.kind === "relevance" ? <RelevanceChart rows={analysis.ranked} /> : null}
              {turn.chartSuggestion?.kind === "coverage" ? (
                <CoverageChart contributions={analysis.coverage.contributions} />
              ) : null}
              {turn.uncertainty ? (
                <p className="mt-1 text-[13px] text-muted-foreground italic">Limitation: {turn.uncertainty}</p>
              ) : null}
            </div>
          ))
        )}
        {pending ? <p className="text-sm text-muted-foreground">Reading the synthetic catalog…</p> : null}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[#2A2D32] px-3 pt-2">
        {PROMPTS.map((prompt) => (
          <button key={prompt} type="button" className="text-left text-[11px] text-muted-foreground hover:text-foreground" onClick={() => ask(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <Input
          aria-label="Ask the demo assistant"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about this mission"
        />
        <Button type="submit" variant="secondary" className="h-7" disabled={pending}>
          Send
        </Button>
      </form>
    </section>
  );

  const recommendations = (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Deterministic proposals from the coverage gaps for {scenario.name}. Proposed experiments, not approved procedures and not verified results.
      </p>
      <p className="text-sm text-muted-foreground">
        Supporting indexed NASA records: {analysis.indexed.summary} {analysis.indexed.caveat} Candidate model: none. {analysis.verifiedPrediction.message} Suggested measurements follow the objective and must include oxygen, total cabin pressure, gravity, airflow, and sample geometry.
      </p>
      {analysis.recommendations.map((item) => (
        <article key={item.id} className="rounded border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-medium">{item.title}</h2>
            <span className="numeric text-[20px] text-foreground">{formatScore(item.priorityScore)}</span>
          </div>
          <p className="mt-2 text-sm">{item.researchQuestion}</p>
          <p className="mt-2 text-sm text-muted-foreground">{item.gapExplanation}</p>
          <p className="mt-2 text-sm">Suggested conditions: {item.suggestedConditions}</p>
          <p className="mt-2 text-sm">{item.expectedValue}</p>
          <p className="mt-2 text-xs text-muted-foreground">{item.limitations}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {item.factors.map((factor) => (
              <li key={factor.key}>
                <div className="flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground">
                  <span className="text-foreground">{factor.label}</span>
                  <span className="numeric">
                    {factor.score.toFixed(2)} × {factor.weight.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 bg-[#3A3E44]">
                  <div className="h-full bg-[#EDEAE4]" style={{ width: `${Math.max(0, Math.min(1, factor.score)) * 100}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{factor.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Related dossiers:{" "}
            {item.relatedInvestigationIds.map((id) => (
              <Link key={id} href={`/research/${id}`} className="numeric mr-2 text-ember-text">
                {id.toUpperCase()}
              </Link>
            ))}
          </p>
        </article>
      ))}
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-cond text-[22px] font-semibold tracking-[0.04em] text-foreground">FireLab</h1>
        <p className="text-sm text-muted-foreground">
          Priority {analysis.recommendations[0] ? formatNumber(analysis.recommendations[0].priorityScore, 2) : "—"} leads this scenario at {formatNumber(scenario.oxygenPct, 1)}% oxygen.
        </p>
      </header>
      <div className="flex w-fit bg-[#1F2125] p-0.5 xl:hidden">
        {(["briefing", "recommendations"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={pane === item}
            className={cn(
              "h-6 px-2.5 font-cond text-[11px] tracking-[0.08em] uppercase",
              pane === item ? "bg-[#36383C] text-foreground shadow-[inset_0_0_0_1px_#EDEAE4]" : "text-muted-foreground",
            )}
            onClick={() => setPane(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className={cn(pane !== "recommendations" && "hidden", "xl:block")}>{recommendations}</div>
        <div className={cn(pane !== "briefing" && "hidden", "xl:block")}>{briefing}</div>
      </div>
    </div>
  );
}
