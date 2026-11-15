import { PageHeader } from "@/components/design/kit";
import { RouteTabs } from "@/components/design/route-tabs";
import { RESEARCH_TABS } from "@/lib/routes";

/** The header every Research page opens with: title, the question it answers, and the section tabs. */
export function ResearchHeader({
  title,
  description,
  eyebrow = "Research",
  actions,
}: {
  title: string;
  description: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} className="mb-4" />
      <RouteTabs tabs={RESEARCH_TABS} label="Research sections" />
    </div>
  );
}
