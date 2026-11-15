import type { Metadata } from "next";
import { ReportView } from "@/components/reports/report-view";

export const metadata: Metadata = {
  title: "Results",
  description: "Review and export the latest fire run and manage saved cabin scenarios.",
};

export default function Page() {
  return <ReportView />;
}
