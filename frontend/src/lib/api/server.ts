import { cookies } from "next/headers";

import { buildApiUrl, parseApiResponse } from "@/lib/api/shared";

export async function apiFetchServer<T>(
  path: string,
  options?: RequestInit & {
    query?: Record<string, string | undefined> | undefined;
  },
) {
  const cookieStore = await cookies();
  const headers = new Headers(options?.headers);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  const cookieHeader = cookieStore.toString();

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(buildApiUrl(path, options?.query), {
    ...options,
    headers,
    cache: "no-store",
  });

  return parseApiResponse<T>(response);
}
