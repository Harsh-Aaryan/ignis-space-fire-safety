import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvestigationDetail } from "@/components/research/investigation-detail";
import { INVESTIGATIONS, investigationById } from "@/data/research/investigations";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return INVESTIGATIONS.map((record) => ({ id: record.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const record = investigationById(id);
  return record ? { title: record.name, description: record.summary } : { title: "Record not found" };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const record = investigationById(id);
  if (!record) notFound();
  return <InvestigationDetail record={record} />;
}
