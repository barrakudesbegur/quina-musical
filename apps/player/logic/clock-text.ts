// A line of text holding clock times («Comencem cap a les 10:00 pm (4:59)»), split so each time's am/pm can sit in its
// own `.unit`: Londrina's capitals leave it as it is (D114). The times come from packages/rules/time.ts formatClock
// ("10:14 pm"); the space before an am/pm becomes a no-break space, so a time never wraps away from it. Pure.

export interface TextPart {
  text: string;
  /** An am/pm after a clock time. */
  unit: boolean;
}

const PERIOD = /(?<=\d:\d\d) (am|pm)\b/g;

export function clockTextParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let from = 0;
  for (const m of text.matchAll(PERIOD)) {
    parts.push({ text: `${text.slice(from, m.index)}\u00a0`, unit: false });
    parts.push({ text: m[1], unit: true });
    from = m.index + m[0].length;
  }
  if (from < text.length || !parts.length) parts.push({ text: text.slice(from), unit: false });
  return parts;
}
