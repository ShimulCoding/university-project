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
    return error.issues?.formErrors?.[0] ?? error.message;
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

  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
        issues?: ApiValidationIssues;
      }
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? "The request could not be completed.",
      response.status,
      payload?.issues,
    );
  }

  return payload as T;
}
