import type { ApiValidationIssues } from "@/types";

const fallbackApiBaseUrl = "http://localhost:4000/api";

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? fallbackApiBaseUrl;

export class ApiError extends Error {
  status: number;
  issues: ApiValidationIssues | undefined;

  constructor(message: string, status: number, issues?: ApiValidationIssues) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const firstFieldError = Object.values(error.issues?.fieldErrors ?? {})
      .flat()
      .find(Boolean);

    return error.issues?.formErrors?.[0] ?? firstFieldError ?? error.message;
  }

  return fallback;
}

export function getApiFieldError(error: unknown, field: string) {
  if (!(error instanceof ApiError)) {
    return null;
  }

  return error.issues?.fieldErrors?.[field]?.[0] ?? null;
}

export function buildApiUrl(path: string, query?: Record<string, string | undefined>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${apiBaseUrl}${normalizedPath}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text().catch(() => "");
  let payload: { message?: string; issues?: ApiValidationIssues } | null = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Response was not valid JSON
  }

  if (!response.ok) {
    let fallbackMessage = "The request could not be completed.";
    
    if (text && !text.trim().startsWith("<")) {
      // Use plain text response if it's not HTML
      fallbackMessage = text.length > 100 ? `${text.slice(0, 100)}...` : text;
    } else if (response.statusText) {
      fallbackMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    } else {
      fallbackMessage = `HTTP Error ${response.status}`;
    }

    throw new ApiError(
      payload?.message ?? fallbackMessage,
      response.status,
      payload?.issues,
    );
  }

  return payload as T;
}
