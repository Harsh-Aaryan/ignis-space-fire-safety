import type { Metadata } from "next";
import { GapsView } from "@/components/research/gaps-view";
import { ResearchHeader } from "@/components/research/research-header";

export const metadata: Metadata = {
  title: "Evidence gaps",
  description: "What has been tested at each gravity level, and where the evidence for lunar and Martian habitats stops.",
};

export default function Page() {
  return (
    <>
      <ResearchHeader
        title="Evidence gaps"
        description="What has been tested at each gravity level, how your cabin compares with those tests, and the questions that remain open."
      />
      <GapsView />
    </>
  );
}
