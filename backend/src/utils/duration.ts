const unitToMs: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMs(value: string) {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const match = value.trim().match(/^(\d+)(ms|s|m|h|d)$/i);

  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amount = Number(match[1] ?? 0);
  const unit = (match[2] ?? "").toLowerCase();

  if (!unit || !(unit in unitToMs)) {
    throw new Error(`Unsupported duration unit: ${value}`);
  }

  return amount * unitToMs[unit]!;
}
