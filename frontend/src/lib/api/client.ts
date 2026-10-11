import { ApiError, buildApiUrl, parseApiResponse } from "@/lib/api/shared";

const CLIENT_REQUEST_TIMEOUT_MS = 15_000;

let refreshingSession: Promise<boolean> | null = null;

// Share rotation across requests. Web Locks also serialize cooperating tabs.
export function recoverClientSession(): Promise<boolean> {
  if (!refreshingSession) {
    const recover = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);
      try {
        const init = { credentials: "include" as const, cache: "no-store" as const, signal: controller.signal, headers: { accept: "application/json" } };
        const current = await fetch(buildApiUrl("/auth/me"), init);
        if (current.ok) return true;
        if (current.status !== 401) return false;
        return (await fetch(buildApiUrl("/auth/refresh"), { ...init, method: "POST" })).ok;
      } finally {
        clearTimeout(timeout);
      }
    };
    const operation = (async () => typeof navigator !== "undefined" && navigator.locks
      ? await navigator.locks.request("mu-session-refresh", recover)
      : await recover())();
    refreshingSession = operation.finally(() => { refreshingSession = null; });
  }
  return refreshingSession!;
}

async function waitForSession(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Request aborted", "AbortError");
  let abort: () => void = () => {};
  try {
    return await new Promise<boolean>((resolve, reject) => {
      abort = () => reject(new DOMException("Request aborted", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      // Cancellation affects this caller; other requests still share recovery.
      recoverClientSession().then(resolve, reject);
    });
  } finally { signal.removeEventListener("abort", abort); }
}

export async function apiFetchClient<T>(
  path: string,
  options?: RequestInit & {
    query?: Record<string, string | undefined> | undefined;
    _isRetry?: boolean;
  },
) {
  const headers = new Headers(options?.headers);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
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
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });

    if (
      response.status === 401 &&
      !options?._isRetry &&
      (!path.startsWith("/auth/") || ["/auth/me", "/auth/update-email", "/auth/mfa/enrollment-grants"].includes(path))
    ) {
      if (await waitForSession(controller.signal)) {
        if (options?.signal?.aborted) throw new DOMException("Request aborted", "AbortError");
        clearTimeout(timeoutId);
        // Token successfully refreshed, retry the original request
        return await apiFetchClient<T>(path, { ...options, _isRetry: true });
      }
    }

    return await parseApiResponse<T>(response);
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
    options?.signal?.removeEventListener("abort", abortFromCaller);
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

export function postFormData<T>(path: string, formData: FormData, headers?: HeadersInit) {
  return apiFetchClient<T>(path, {
    method: "POST",
    body: formData,
    ...(headers ? { headers } : {}),
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
