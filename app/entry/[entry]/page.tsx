import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ParentQuery } from "@/components/ParentQuery";
import { queryScopeForEntry } from "@/lib/query-scope";

export default async function EntryPage({ params }: { params: Promise<{ entry: string }> }) {
  const { entry } = await params;
  try { queryScopeForEntry(entry); } catch { notFound(); }
  return <Suspense fallback={<main className="parent-shell" />}><ParentQuery entry={entry} /></Suspense>;
}
