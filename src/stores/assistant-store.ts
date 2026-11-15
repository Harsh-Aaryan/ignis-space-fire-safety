"use client";
import { create } from "zustand";
export const useAssistantStore = create<{ open: boolean; draft: string; setDraft: (draft: string) => void; show: (draft?: string) => void; close: () => void }>(set => ({
  open: false, draft: "", setDraft: (draft) => set({ draft }), show: (draft = "") => set({ open: true, draft }), close: () => set({ open: false }),
}));
