import type { Metadata } from "next";
import { Suspense } from "react";
import { ResearchExplorer, ResearchExplorerFromQuery } from "@/components/research/explorer";
import { ResearchHeader } from "@/components/research/research-header";

export const metadata: Metadata = {
  title: "Investigations",
  description: "NASA fire-safety investigations, indexed by the crew environments they bear on.",
};

export default function Page() {
  return (
    <>
      <ResearchHeader
        title="Investigations"
        description="Which experiments, tests and standards bear on fire safety where crews live: spacecraft, space stations, lunar and Martian surface habitats, and pressurized rovers."
      />
      <Suspense fallback={<ResearchExplorer />}>
        <ResearchExplorerFromQuery />
      </Suspense>
    </>
  );
}
