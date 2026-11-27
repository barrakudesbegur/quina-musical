// The arrow keys in a group with one Tab stop (a roving tabindex): radios, segmented options, tabs (the ARIA radio
// group and tabs patterns). Pure, so the components share it and the tests read it.

/** The index the key moves to from `index`, skipping disabled items and wrapping round; null when the key isn't one
 *  of the group's (←/↑ previous, →/↓ next, Home first, End last) or nothing else is usable. */
export function nextEnabled(items: readonly { readonly disabled?: boolean }[], index: number, key: string): number | null {
  const n = items.length;
  if (n === 0) return null;
  const usable = (i: number) => !items[i]?.disabled;
  const scan = (from: number, step: 1 | -1): number | null => {
    for (let k = 1; k <= n; k++) {
      const i = (((from + step * k) % n) + n) % n;
      if (usable(i)) return i;
    }
    return null;
  };
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return scan(index, 1);
    case 'ArrowLeft':
    case 'ArrowUp':
      return scan(index, -1);
    case 'Home':
      return scan(-1, 1);
    case 'End':
      return scan(n, -1);
    default:
      return null;
  }
}
