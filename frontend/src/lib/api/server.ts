import { cookies } from "next/headers";

import { ApiError, buildApiUrl, parseApiResponse } from "@/lib/api/shared";

const SERVER_REQUEST_TIMEOUT_MS = 15_000;

export async function apiFetchServer<T>(
  path: string,
  options?: RequestInit & {
    query?: Record<string, string | undefined> | undefined;
  },
) {
  const cookieStore = await cookies();
  const headers = new Headers(options?.headers);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SERVER_REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  const cookieHeader = cookieStore.toString();

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  try {
    const response = await fetch(buildApiUrl(path, options?.query), {
      ...options,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    return await parseApiResponse<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The backend request took too long. Please try again.", 408);
    }

    if (error instanceof TypeError) {
      throw new ApiError("Cannot reach the backend right now.", 503);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    options?.signal?.removeEventListener("abort", abortFromCaller);
  }
}
