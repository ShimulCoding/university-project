export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function buildRelativeHref(
  pathname: string,
  searchParams: SearchParamsRecord,
  updates: Record<string, string | undefined>,
) {
  const nextParams = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => nextParams.append(key, item));
      return;
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();

      if (trimmedValue) {
        nextParams.set(key, trimmedValue);
      }
    }
  });

  Object.entries(updates).forEach(([key, value]) => {
    nextParams.delete(key);

    if (value?.trim()) {
      nextParams.set(key, value.trim());
    }
  });

  const query = nextParams.toString();

  return query ? `${pathname}?${query}` : pathname;
}
