// Card numbers written back as ranges, the way `setCardsInPlay` takes them ("1-180, 200-215, 400"): Admin's preview
// and the console's «Afegeix cartrons venuts» (D234) both send them. Reading them is the protocol's parseCardRanges.
// Pure.

/** [1, 2, 3, 7, 9, 10] → "1-3, 7, 9-10". Expects sorted unique ids (parseCardRanges gives those). */
export function formatCardRanges(ids: readonly number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < ids.length) {
    let j = i;
    while (j + 1 < ids.length && ids[j + 1] === ids[j] + 1) j++;
    parts.push(i === j ? String(ids[i]) : `${ids[i]}-${ids[j]}`);
    i = j + 1;
  }
  return parts.join(', ');
}
