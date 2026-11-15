"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Cite } from "@/components/fire/cite";
import { Note, TextLink, actionClass } from "@/components/design/kit";
import { objectById, roomById } from "@/data/habitat-interiors";
import { runFire, type FireInput } from "@/lib/fire/model";
import { buildFireInput } from "@/lib/fire/scenario";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { ScenarioAnswer } from "@/services/scenario-assistant";
import { captureChatContext, MAX_HISTORY, MAX_QUESTION_LENGTH } from "@/services/scenario-chat";
import { useAssistantStore } from "@/stores/assistant-store";
import { fireRuntime, useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";

export function AskIgnisButton({ prompt, label = "Ask IGNIS" }: { prompt?: string; label?: string }) {
  const show = useAssistantStore((s) => s.show);
  return (
    <button
      type="button"
      onClick={() => show(prompt)}
      aria-label={label}
      className={cn(actionClass("secondary"), "shrink-0 px-3.5 md:min-h-9")}
    >
      <MessageCircle className="size-4 text-ember-text" strokeWidth={1.75} aria-hidden="true" />
      {label}
    </button>
  );
}

const PROMPTS = [
  "Explain this run",
  "Why hasn't the smoke detector alarmed?",
  "What changes if I stop ventilation?",
  "Which NASA experiment supports this?",
  "Which parts are assumptions?",
];

type Turn = { question: string; answer: ScenarioAnswer; input: FireInput | null };

export function ScenarioAssistant() {
  const { open, close, draft, setDraft } = useAssistantStore();
  const mission = useMissionStore();
  const sim = useFireSimStore();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const pendingRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // sim.status is a deliberate dependency: fireRuntime.input changes when a run starts or stops.
  const input = useMemo(() => {
    if (fireRuntime.input) return fireRuntime.input;
    const object = objectById(mission.selectedObjectId);
    const room = roomById(object?.roomId ?? null);
    return object && room ? buildFireInput(mission.scenario, room, object, sim.config) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission.scenario, mission.selectedObjectId, sim.config, sim.status]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns, pendingQuestion, error]);

  useEffect(() => () => pendingRef.current?.abort(), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        close();
      }
      if (event.key === "Tab" && window.innerWidth < 768) {
        const targets = panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled)");
        if (!targets?.length) return;
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", keys, true);
    return () => {
      document.removeEventListener("keydown", keys, true);
      previous?.focus();
    };
  }, [open, close]);

  if (!open) return null;

  async function ask(q: string) {
    const question = q.trim();
    if (!question || pendingRef.current) return;
    const controller = new AbortController();
    pendingRef.current = controller;
    const capturedInput = input;
    const payload = {
      message: question,
      ...captureChatContext(input, sim.snapshot),
      history: turns.slice(-MAX_HISTORY).map((turn) => turn.question),
    };
    setPendingQuestion(question);
    setDraft("");
    setComparison(null);
    setError(null);
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/ask-ignis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          response.status === 429 ? "Too many questions. Please wait a minute." : "Could not get an answer. Please try again.",
        );
      }
      const answer: ScenarioAnswer = await response.json();
      setTurns((t) => [...t.slice(-19), { question, answer, input: capturedInput }]);
    } catch (failure) {
      setError(
        controller.signal.aborted
          ? "The answer took too long. Please try again."
          : failure instanceof Error
            ? failure.message
            : "Could not get an answer.",
      );
      setDraft(question);
    } finally {
      clearTimeout(timeout);
      pendingRef.current = null;
      setPendingQuestion(null);
    }
  }

  function compare(capturedInput: FireInput | null) {
    if (!capturedInput) return;
    const baseline = runFire(capturedInput, { durationS: 180 });
    const stopped = runFire(capturedInput, { durationS: 180, actions: [{ t: 30, id: "vent-off" }] });
    setComparison(
      `Fresh 180 s runs of this setup: normal flow peak ${(baseline.state.peakHrrW / 1000).toFixed(2)} kW, heat ${(
        baseline.state.totalHeatJ / 1000
      ).toFixed(1)} kJ, final phase ${baseline.state.phase}; fan isolation at 30 s peak ${(stopped.state.peakHrrW / 1000).toFixed(
        2,
      )} kW, heat ${(stopped.state.totalHeatJ / 1000).toFixed(1)} kJ, final phase ${stopped.state.phase}. These are model estimates.`,
    );
  }

  return (
    <aside
      ref={panelRef}
      aria-label="Ask IGNIS scenario assistant"
      className="no-print fixed inset-x-2 top-16 bottom-20 z-50 flex min-h-0 flex-col rounded-md border border-border bg-card shadow-2xl md:static md:z-auto md:m-0 md:w-[360px] md:shrink-0 md:rounded-none md:border-y-0 md:border-r-0 md:border-l-border-subtle md:shadow-none"
    >
      <header className="flex items-start gap-3 border-b border-border-subtle px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] leading-5 font-medium text-foreground">Ask IGNIS</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">Questions about your scenario, answered with sources.</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close assistant"
          className="-mt-1 -mr-2 flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-elev-3 hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Ask about the fire scenario you have set up and the NASA evidence behind it. Each answer uses the scenario as it stands when you ask.
        </p>
        <Note>
          Answers draw on the cited sources and on the model output at the moment you ask. Model results are estimates; a citation shows
          where an input came from, not that a prediction is accurate.
        </Note>

        <div className="flex flex-col gap-2">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={!!pendingQuestion}
              onClick={() => void ask(prompt)}
              className="min-h-10 rounded-md border border-border-subtle px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-border hover:bg-elev-2 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {turns.map((turn, i) => (
          <article key={i} className="space-y-2 border-t border-border-subtle pt-4">
            <p className="text-sm font-medium text-foreground">{turn.question}</p>
            <p className="text-[12px] leading-5 text-text-tertiary">
              {turn.answer.context}
              {" · "}
              {turn.answer.provider === "groq" ? "Generated explanation (Groq)" : "Explanation from local sources"}
            </p>
            {turn.answer.notice ? <p className="text-[13px] leading-5 text-muted-foreground">{turn.answer.notice}</p> : null}
            <p className="text-sm leading-6 whitespace-pre-line text-foreground">{turn.answer.text}</p>
            <p className="flex flex-wrap gap-2">
              {[...new Set(turn.answer.sources)].map((id) => (
                <Cite key={id} id={id} />
              ))}
            </p>
            {turn.answer.compareVentilation ? (
              <button type="button" onClick={() => compare(turn.input)} className={actionClass("secondary")}>
                Compare fan shutdown in a copy
              </button>
            ) : null}
          </article>
        ))}

        {pendingQuestion ? (
          <div role="status" className="space-y-1 border-t border-border-subtle pt-4">
            <p className="text-sm font-medium text-foreground">{pendingQuestion}</p>
            <p className="text-sm text-muted-foreground">Checking the scenario and sources…</p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-md border border-border px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}
        {comparison ? (
          <p role="status" className="rounded-md bg-elev-2 px-3 py-2 text-sm leading-6">
            {comparison}
          </p>
        ) : null}

        <TextLink href={ROUTES.modelingData} className="text-sm">
          Browse the NASA modeling data
        </TextLink>
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
        className="flex gap-2 border-t border-border-subtle p-3"
      >
        <input
          ref={inputRef}
          aria-label="Ask IGNIS a question"
          maxLength={MAX_QUESTION_LENGTH}
          disabled={!!pendingQuestion}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about this scenario"
          className="min-h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm placeholder:text-text-tertiary"
        />
        <button
          type="submit"
          disabled={!!pendingQuestion || !draft.trim()}
          aria-label="Send question"
          className={cn(actionClass("primary"), "px-3")}
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}
