import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView, CompareViewFromQuery } from "@/components/research/compare-view";
import { ResearchHeader } from "@/components/research/research-header";

export const metadata: Metadata = {
  title: "Compare investigations",
  description: "Two or three fire-safety investigations side by side: conditions, materials, findings, limitations, and where their results can be compared.",
};

export default function Page() {
  return (
    <>
      <ResearchHeader
        title="Compare investigations"
        description="Set two or three investigations side by side, see what IGNIS holds for each, and where their results can reasonably be compared."
      />
      <Suspense fallback={<CompareView ids={[]} />}>
        <CompareViewFromQuery />
      </Suspense>
    </>
  );
}
