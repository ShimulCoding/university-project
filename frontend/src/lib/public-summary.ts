import type { PublicFinancialSummary } from "@/types";

export function getLatestPublishedSummariesPerEvent(
  summaries: PublicFinancialSummary[],
) {
  const latestByEventSlug = new Map<string, PublicFinancialSummary>();

  for (const summary of summaries) {
    const existing = latestByEventSlug.get(summary.event.slug);

    // Keep the summary with the most recent publishedAt per event slug,
    // rather than relying on the API response order.
    if (
      !existing ||
      new Date(summary.publishedAt).getTime() >
        new Date(existing.publishedAt).getTime()
    ) {
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
