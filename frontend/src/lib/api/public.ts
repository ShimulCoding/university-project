import type { PublicEvent, PublicFinancialSummary } from "@/types";

import { apiFetchServer } from "@/lib/api/server";

export async function listPublicEvents(query?: {
  status?: string;
  search?: string;
}) {
  const response = await apiFetchServer<{ events: PublicEvent[] }>("/events", {
    query,
  });

  return response.events;
}

export async function getPublicEvent(eventLookup: string) {
  const response = await apiFetchServer<{ event: PublicEvent }>(`/events/${eventLookup}`);
  return response.event;
}

export async function listPublicFinancialSummaries(query?: { search?: string }) {
  const response = await apiFetchServer<{ summaries: PublicFinancialSummary[] }>(
    "/public/financial-summaries",
    {
      query,
    },
  );

  return response.summaries;
}

export async function getPublicFinancialSummary(eventLookup: string) {
  const response = await apiFetchServer<{ summary: PublicFinancialSummary }>(
    `/public/financial-summaries/${eventLookup}`,
  );

  return response.summary;
}
