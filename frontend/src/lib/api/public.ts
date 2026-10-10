import { apiList } from "@/lib/api/list";
import type { PublicEvent, PublicFinancialSummary } from "@/types";

import { apiFetchServer } from "@/lib/api/server";

export async function listPublicEvents(query?: { page?: string;
  status?: string;
  search?: string;
}) {
  return apiList<PublicEvent>("/events", "events", query);
}

export async function getPublicEvent(eventLookup: string) {
  const response = await apiFetchServer<{ event: PublicEvent }>(`/events/${eventLookup}`);
  return response.event;
}

export async function listPublicFinancialSummaries(query?: { page?: string; search?: string }) {
  return apiList<PublicFinancialSummary>("/public/financial-summaries", "summaries", { ...query, latestOnly: "true" });
}

export async function getPublicFinancialSummary(eventLookup: string) {
  const response = await apiFetchServer<{ summary: PublicFinancialSummary }>(
    `/public/financial-summaries/${eventLookup}`,
  );

  return response.summary;
}
