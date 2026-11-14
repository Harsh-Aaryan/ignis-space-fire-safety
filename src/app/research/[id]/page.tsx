import { InvestigationDetail } from "@/components/research/explorer";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvestigationDetail id={id} />;
}
