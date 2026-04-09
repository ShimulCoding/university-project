import { buildApiUrl, parseApiResponse } from "@/lib/api/shared";

export async function apiFetchClient<T>(
  path: string,
  options?: RequestInit & {
    query?: Record<string, string | undefined> | undefined;
  },
) {
  const headers = new Headers(options?.headers);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  const response = await fetch(buildApiUrl(path, options?.query), {
    ...options,
    headers,
    credentials: "include",
  });

  return parseApiResponse<T>(response);
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
