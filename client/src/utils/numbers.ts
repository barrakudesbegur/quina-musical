export function clampLoop<T extends number | null | undefined>(
  value: T,
  maxValue: number | null | undefined
) {
  if (
    maxValue === null ||
    maxValue === undefined ||
    value === null ||
    value === undefined
  ) {
    return value;
  }
  return value % maxValue;
}
