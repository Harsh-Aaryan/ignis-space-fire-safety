"use client";
import { create } from "zustand";

interface AssistantState {
  open: boolean;
  draft: string;
  /** A preset question waiting to be sent once the assistant is open. */
  queued: string | null;
  setDraft: (draft: string) => void;
  /** Opens the assistant. A prompt is sent as a question straight away, not left in the input. */
  show: (prompt?: string) => void;
  /** Hands the queued question to the assistant and clears it. */
  takeQueued: () => string | null;
  close: () => void;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  open: false,
  draft: "",
  queued: null,
  setDraft: (draft) => set({ draft }),
  show: (prompt) => {
    const question = prompt?.trim();
    set(question ? { open: true, queued: question } : { open: true, draft: "" });
  },
  takeQueued: () => {
    const { queued } = get();
    if (queued) set({ queued: null });
    return queued;
  },
  close: () => set({ open: false }),
}));
