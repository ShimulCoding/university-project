// undefined means the browser fragment is not available during SSR/hydration.
// Keep existing query links valid, but never fall back from a malformed token
// fragment to a different query capability.
export function resolveResetToken(fragment: string | undefined, legacyQuery: string | null): string | null | undefined {
  if (fragment === undefined) return undefined;
  if (fragment.length > 1024) return null;
  const tokens = new URLSearchParams(fragment.replace(/^#/, "")).getAll("token");
  if (tokens.length > 1) return null;
  const token = tokens.length === 1 ? tokens[0] : legacyQuery;
  return token && token.length <= 128 ? token : null;
}
