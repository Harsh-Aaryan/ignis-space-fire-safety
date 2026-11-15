"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { useAssistantStore } from "@/stores/assistant-store";
import { useFireSimStore, fireRuntime } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import { objectById, roomById } from "@/data/habitat-interiors";
import { buildFireInput } from "@/lib/fire/scenario";
import { runFire, type FireInput } from "@/lib/fire/model";
import type { ScenarioAnswer } from "@/services/scenario-assistant";
import { captureChatContext, MAX_HISTORY, MAX_QUESTION_LENGTH } from "@/services/scenario-chat";
import { Cite } from "@/components/fire/cite";

export function AskIgnisButton({ prompt, label = "Ask IGNIS" }: { prompt?: string; label?: string }) {
  const show = useAssistantStore(s => s.show);
  return <button type="button" onClick={() => show(prompt)} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded border border-primary/70 bg-primary/15 px-3 text-sm font-medium text-ember-text" aria-label={label}><MessageCircle className="size-4"/>{label}</button>;
}
const prompts = ["Explain this run", "Why hasn't the smoke detector alarmed?", "What changes if I stop ventilation?", "Which NASA experiment supports this?", "Which parts are assumptions?"];
export function ScenarioAssistant() {
  const ui = useAssistantStore(), mission = useMissionStore(), sim = useFireSimStore();
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<{ question: string; answer: ScenarioAnswer; input: FireInput | null }[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<AbortController | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null), endRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const input = useMemo(() => {
    if (fireRuntime.input) return fireRuntime.input;
    const o = objectById(mission.selectedObjectId), room = roomById(o?.roomId ?? null);
    return o && room ? buildFireInput(mission.scenario, room, o, sim.config) : null;
  }, [mission.scenario, mission.selectedObjectId, sim.config, sim.status]);
  useEffect(() => { if (ui.open) { setDraft(ui.draft); inputRef.current?.focus(); } }, [ui.open, ui.draft]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [turns, pendingQuestion, error]);
  useEffect(() => () => pendingRef.current?.abort(), []);
  useEffect(() => {
    if (!ui.open) return;
    const previous = document.activeElement as HTMLElement | null;
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); ui.close(); }
      if (event.key === "Tab" && window.innerWidth < 768) {
        const targets = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input');
        if (!targets?.length) return;
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", keys, true);
    return () => { document.removeEventListener("keydown", keys, true); previous?.focus(); };
  }, [ui.open, ui.close]);
  if (!ui.open) return null;
  async function ask(q: string) {
    const question = q.trim();
    if (!question || pendingRef.current) return;
    const controller = new AbortController();
    pendingRef.current = controller;
    const capturedInput = input;
    const payload = { message: question, ...captureChatContext(input, sim.snapshot), history: turns.slice(-MAX_HISTORY).map(turn => turn.question) };
    setPendingQuestion(question); setDraft(""); setComparison(null); setError(null);
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/ask-ignis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 429 ? "Too many questions. Please wait a minute." : "Could not get an answer. Please try again.");
      const answer: ScenarioAnswer = await response.json();
      setTurns(t => [...t.slice(-19), { question, answer, input: capturedInput }]);
    } catch (failure) {
      setError(controller.signal.aborted ? "The answer took too long. Please try again." : failure instanceof Error ? failure.message : "Could not get an answer.");
      setDraft(question);
    } finally {
      clearTimeout(timeout); pendingRef.current = null; setPendingQuestion(null);
    }
  }
  function compare(capturedInput: FireInput | null) {
    if (!capturedInput) return;
    const baseline = runFire(capturedInput, { durationS: 180 });
    const stopped = runFire(capturedInput, { durationS: 180, actions: [{ t: 30, id: "vent-off" }] });
    setComparison(`Fresh 180 s runs of this setup: normal flow peak ${(baseline.state.peakHrrW/1000).toFixed(2)} kW, heat ${(baseline.state.totalHeatJ/1000).toFixed(1)} kJ, final phase ${baseline.state.phase}; fan isolation at 30 s peak ${(stopped.state.peakHrrW/1000).toFixed(2)} kW, heat ${(stopped.state.totalHeatJ/1000).toFixed(1)} kJ, final phase ${stopped.state.phase}. These are exploratory model outputs.`);
  }
  return <aside ref={panelRef} aria-label="Ask IGNIS scenario assistant" className="no-print fixed inset-x-2 top-16 bottom-16 z-50 flex min-h-0 flex-col rounded-lg border border-primary/40 bg-card shadow-2xl md:static md:z-auto md:m-0 md:w-[360px] md:shrink-0 md:rounded-none md:border-y-0 md:border-r-0">
    <header className="flex items-start gap-3 border-b border-border p-4"><MessageCircle className="mt-1 size-5 text-ember-text"/><div className="flex-1"><h2 className="text-base font-semibold">Ask IGNIS</h2><p className="mt-1 text-xs text-muted-foreground">Scenario assistant · sourced explanations</p></div><button ref={undefined} type="button" onClick={ui.close} aria-label="Close assistant" className="rounded p-1.5 hover:bg-secondary"><X className="size-4"/></button></header>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <p className="text-sm leading-6 text-muted-foreground">Understand your fire scenario and the NASA evidence behind it. Answers capture the scenario at the time you ask.</p>
      <p className="rounded border border-border p-2 text-xs text-muted-foreground">Answers use project source extracts and captured model output. Model results are exploratory; citations do not establish predictive accuracy.</p>
      <div className="flex flex-col gap-2">{prompts.map(p=><button key={p} type="button" disabled={!!pendingQuestion} onClick={()=>void ask(p)} className="rounded border border-border px-3 py-2 text-left text-sm hover:border-primary/60 disabled:opacity-50">{p}</button>)}</div>
      {turns.map((turn,i)=><article key={i} className="space-y-2 border-t border-border pt-3"><p className="text-sm font-medium">{turn.question}</p><p className="text-xs text-muted-foreground">{turn.answer.context}</p><p className="text-xs text-muted-foreground">{turn.answer.provider === "groq" ? "AI explanation · Groq" : "Local explanation"}</p>{turn.answer.notice?<p className="text-xs text-muted-foreground">{turn.answer.notice}</p>:null}<p className="whitespace-pre-line text-sm leading-6">{turn.answer.text}</p><p className="flex flex-wrap gap-2">{[...new Set(turn.answer.sources)].map(id=><Cite key={id} id={id}/>)}</p>{turn.answer.compareVentilation?<button onClick={()=>compare(turn.input)} className="rounded border border-primary/60 px-3 py-2 text-sm text-ember-text">Compare fan shutdown in a copy</button>:null}</article>)}
      {pendingQuestion?<div role="status" className="space-y-2 border-t border-border pt-3"><p className="text-sm font-medium">{pendingQuestion}</p><p className="text-sm text-muted-foreground">Checking the scenario and sources…</p></div>:null}
      {error?<p role="alert" className="rounded border border-border p-3 text-sm">{error}</p>:null}
      {comparison?<p role="status" className="rounded bg-secondary p-3 text-sm leading-6">{comparison}</p>:null}
      <Link href="/materials" className="inline-block text-sm text-ember-text underline">Explore original NASA data</Link><div ref={endRef}/>
    </div>
    <form onSubmit={e=>{e.preventDefault();void ask(draft);}} className="flex gap-2 border-t border-border p-3"><input ref={inputRef} aria-label="Ask IGNIS a question" maxLength={MAX_QUESTION_LENGTH} disabled={!!pendingQuestion} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ask about this scenario" className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm"/><button type="submit" disabled={!!pendingQuestion || !draft.trim()} aria-label="Send question" className="rounded bg-primary px-3 text-primary-foreground disabled:opacity-50"><Send className="size-4"/></button></form>
  </aside>;
}
