import type { Metadata } from "next";
import { Suspense } from "react";
import { ModelingDataFromQuery, ModelingDataView } from "@/components/research/modeling-data-view";
import { ResearchHeader } from "@/components/research/research-header";

export const metadata: Metadata = {
  title: "Modeling data",
  description: "NASA experiment tables, material properties and reference burns that a fire model can be built on and checked against.",
};

export default function Page() {
  return (
    <>
      <ResearchHeader
        title="Modeling data"
        description="The measurements a model of flammability and fire growth can be built on, and the flight results it can be checked against."
      />
      <Suspense fallback={<ModelingDataView />}>
        <ModelingDataFromQuery />
      </Suspense>
    </>
  );
}
