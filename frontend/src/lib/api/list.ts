import { apiFetchServer } from "@/lib/api/server";

export type Pagination = { page: number; pageSize: number; totalItems: number; totalPages: number; historicalSnapshotCount?: number };
export type PaginatedList<T> = T[] & { pagination: Pagination };

export function queryPage(value: string | string[] | undefined) {
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? value : "1";
}

export async function apiList<T>(path: string, key: string, query?: Record<string, string | undefined>) {
  const response = await apiFetchServer<Record<string, unknown> & { pagination: Pagination }>(path, { query });
  return Object.assign(response[key] as T[], { pagination: response.pagination });
}

// Select controls need the complete option catalog, fetched in bounded pages.
export async function apiOptions<T>(path: string, key: string, query?: Record<string, string | undefined>) {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await apiList<T>(path, key, { ...query, page: String(page), pageSize: "100" });
    items.push(...batch);
    if (page >= batch.pagination.totalPages) return items;
  }
}
