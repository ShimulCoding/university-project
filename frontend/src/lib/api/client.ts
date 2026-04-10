import { ApiError, buildApiUrl, parseApiResponse } from "@/lib/api/shared";

const CLIENT_REQUEST_TIMEOUT_MS = 15_000;

export async function apiFetchClient<T>(
  path: string,
  options?: RequestInit & {
    query?: Record<string, string | undefined> | undefined;
  },
) {
  const headers = new Headers(options?.headers);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(buildApiUrl(path, options?.query), {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });

    return parseApiResponse<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The request took too long. Please try again.", 408);
    }

    if (error instanceof TypeError) {
      throw new ApiError(
        "Cannot reach the backend right now. Check that the local servers are running and try again.",
        503,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function postJson<T>(path: string, body: unknown) {
  return apiFetchClient<T>(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function postFormData<T>(path: string, formData: FormData) {
  return apiFetchClient<T>(path, {
    method: "POST",
    body: formData,
  });
}

export function patchJson<T>(path: string, body: unknown) {
  return apiFetchClient<T>(path, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function postEmpty<T>(path: string) {
  return apiFetchClient<T>(path, {
    method: "POST",
  });
}
