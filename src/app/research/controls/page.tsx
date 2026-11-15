import type { Metadata } from "next";
import { ControlsView } from "@/components/research/controls-view";
import { ResearchHeader } from "@/components/research/research-header";

export const metadata: Metadata = {
  title: "Detection and suppression",
  description: "What NASA's fire research tells the designers of the next detectors, extinguishers and material controls.",
};

export default function Page() {
  return (
    <>
      <ResearchHeader
        title="Detection and suppression"
        description="What the research tells the designers of the next generation of fire detectors, suppression equipment and material controls."
      />
      <ControlsView />
    </>
  );
}
