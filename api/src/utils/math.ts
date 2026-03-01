/**
 * Clamps value to the given [min, max] range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamps value to the unit interval [0, 1].
 * Non-finite values are normalized to 0.
 */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return clamp(value, 0, 1);
}
