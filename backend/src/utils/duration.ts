const unitToMs: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMs(value: string) {
  if (/^\d+$/.test(value)) {
    const duration = Number(value);
    if (!Number.isSafeInteger(duration) || duration <= 0) throw new Error("Token lifetime must be positive.");
    return duration;
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

  const duration = amount * unitToMs[unit]!;
  if (!Number.isSafeInteger(duration) || duration <= 0) throw new Error("Token lifetime must be positive.");
  return duration;
}
