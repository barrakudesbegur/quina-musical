// Where a song row's card icons sit (Historial; board Mobil-B-J2): packed zig-zag at the row's right edge, so several
// cards take little width. One is centred, two side by side, three a triangle, four a rhombus, five three below and
// two above, and so on. Pure: positions in px for icons of `size`.

export interface MarkerSpot {
  left: number;
  top: number;
}

export interface MarkerLayout {
  width: number;
  height: number;
  spots: MarkerSpot[];
}

export function markerLayout(count: number, size = 28, dx = 25, dy = 20, height = 50): MarkerLayout {
  if (count <= 0) return { width: 0, height, spots: [] };
  let pos: [number, number][];
  if (count <= 2) {
    pos = Array.from({ length: count }, (_, i) => [(i - (count - 1) / 2) * dx, 0]);
  } else {
    const base = Math.ceil(count / 2);
    const top = count - base;
    const shift = top === base ? -dx / 2 : 0;
    pos = [
      ...Array.from({ length: base }, (_, i): [number, number] => [(i - (base - 1) / 2) * dx, dy / 2]),
      ...Array.from({ length: top }, (_, i): [number, number] => [(i - (top - 1) / 2) * dx + shift, -dy / 2]),
    ];
  }
  const xs = pos.map(([x]) => x);
  const min = Math.min(...xs);
  const width = Math.max(...xs) - min + size;
  return { width, height, spots: pos.map(([x, y]) => ({ left: x - min, top: height / 2 + y - size / 2 })) };
}
