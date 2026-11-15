"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { EMPTY_QUESTION, type ResearchQuestion } from "@/lib/research/rank";

/** Shared contract: the research question and the investigations picked for comparison and the evidence brief. */
/** Same limit as MAX_COMPARE in src/lib/research/compare.ts, kept here so the store does not load the comparison code. */
export const MAX_COMPARE = 3;

interface ResearchBriefState {
  /** The question as asked: typed text and explicit choices. The cabin is not stored; it is read live when ranking. */
  question: ResearchQuestion;
  /** Investigation ids, in the order picked. At most MAX_COMPARE. */
  selectedIds: string[];
  /** Rank against the cabin set in the top bar. */
  matchCabin: boolean;
  setQuestion: (question: ResearchQuestion) => void;
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[]) => void;
  clearSelected: () => void;
  setMatchCabin: (value: boolean) => void;
}

export const useResearchBriefStore = create<ResearchBriefState>()(
  persist(
    (set) => ({
      question: EMPTY_QUESTION,
      selectedIds: [],
      matchCabin: false,
      setQuestion: (question) => set({ question: { ...question, cabin: null } }),
      toggleSelected: (id) =>
        set((state) =>
          state.selectedIds.includes(id)
            ? { selectedIds: state.selectedIds.filter((x) => x !== id) }
            : state.selectedIds.length >= MAX_COMPARE
              ? state
              : { selectedIds: [...state.selectedIds, id] },
        ),
      setSelected: (ids) => set({ selectedIds: [...new Set(ids)].slice(0, MAX_COMPARE) }),
      clearSelected: () => set({ selectedIds: [] }),
      setMatchCabin: (matchCabin) => set({ matchCabin }),
    }),
    { name: "ignis-research-brief", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
