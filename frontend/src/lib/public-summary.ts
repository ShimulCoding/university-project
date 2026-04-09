import type { PublicFinancialSummary } from "@/types";

export function getLatestPublishedSummariesPerEvent(
  summaries: PublicFinancialSummary[],
) {
  const latestByEventSlug = new Map<string, PublicFinancialSummary>();

  for (const summary of summaries) {
    if (!latestByEventSlug.has(summary.event.slug)) {
      latestByEventSlug.set(summary.event.slug, summary);
    }
  }

  return Array.from(latestByEventSlug.values());
}

export function getHistoricalPublishedSnapshotCount(
  summaries: PublicFinancialSummary[],
) {
  return summaries.length - getLatestPublishedSummariesPerEvent(summaries).length;
}
