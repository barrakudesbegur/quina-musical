// A QR code as one SVG path, from the module matrix the `qrcode` package computes. Building the path here
// (instead of inserting the package's SVG markup) keeps the DOM free of parsed markup and lets the theme
// colour the code with tokens. Pure: the matrix is passed in.

export interface QrMatrix {
  size: number;
  isDark(row: number, col: number): boolean;
}

export interface QrPath {
  /** Width and height of the viewBox, quiet zone included (modules). */
  viewBox: number;
  /** One sub-path per horizontal run of dark modules. */
  d: string;
}

/** The SVG path of `matrix` with a quiet zone of `margin` modules around it. */
export function qrPathData(matrix: QrMatrix, margin = 2): QrPath {
  const parts: string[] = [];
  for (let row = 0; row < matrix.size; row++) {
    let col = 0;
    while (col < matrix.size) {
      if (!matrix.isDark(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < matrix.size && matrix.isDark(row, col)) col++;
      const run = col - start;
      parts.push(`M${start + margin} ${row + margin}h${run}v1h-${run}z`);
    }
  }
  return { viewBox: matrix.size + margin * 2, d: parts.join('') };
}

/** The player app's link for an edition ("https://quina.barrakudesbegur.org/26"), and its short label. */
export function playerAppLink(edition: string | null | undefined, app: { origin: string; label: string }): { href: string; label: string } {
  const tag = edition && /^[0-9]{2}$/.test(edition) ? edition : null;
  return tag ? { href: `${app.origin}/${tag}`, label: `${app.label}/${tag}` } : { href: app.origin, label: app.label };
}
