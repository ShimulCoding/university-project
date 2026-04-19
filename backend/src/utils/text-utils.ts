export function sanitizeOptionalText(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

export function sanitizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}
