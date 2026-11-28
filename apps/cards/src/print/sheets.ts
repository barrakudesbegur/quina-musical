// Where each card goes on the printed sheets, and which pages a sheet prints. Pure and self-contained (no imports),
// so the tests run it as it is.
//
// - **Page order:** sheet p holds the type's cards p, p + sheets, p + 2 × sheets… (by index), so once the stack of
//   sheets is cut, each pile of cards runs in number order.
// - **Samples (D264):** a type's amount rarely fills its last sheets (399 normal cards, 6 a sheet: 3 empty places). The
//   empty places, in page order, hold copies of the type's last cards (#397, #398, #399), each marked «MOSTRA». A
//   sample is not a card: it isn't in cards.json, and nobody can play it.
// - **Duplex:** a sheet prints side 1, then side 2… on the following pages. Printed double-sided and flipped on the long
//   edge, a back page's rows come out mirrored, so each row's cards are drawn in reverse order there: every card's side
//   2 lands behind its side 1.
// - **Test sheets (D306):** the user's A3 test sheets repeat a type's last cards, the same cards as the run's.

/** One place on a sheet: the index of the card it prints (0 is the type's first card), and whether it is a sample. */
export interface Slot {
  cardIndex: number;
  sample: boolean;
}

/**
 * The sheets for `amount` cards, `perSheet` to a sheet: each sheet's places in reading order (row by row, left to
 * right as side 1 shows them). Every place is filled: the ones the amount leaves empty hold samples, copies of the
 * last cards in order (when there are more empty places than cards, the copies go round the cards again).
 */
export function sheetSlots(amount: number, perSheet: number): Slot[][] {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`sheetSlots: the amount must be a whole number from 0 (got ${amount})`);
  if (!Number.isInteger(perSheet) || perSheet < 1) throw new Error(`sheetSlots: the places a sheet must be a whole number from 1 (got ${perSheet})`);
  const sheets = Math.ceil(amount / perSheet);
  const out: (Slot | null)[][] = Array.from({ length: sheets }, (_, p) =>
    Array.from({ length: perSheet }, (_, k) => {
      const i = k * sheets + p;
      return i < amount ? { cardIndex: i, sample: false } : null;
    }),
  );
  // The empty places in page order (sheet, then place), filled with the last cards in order.
  const empty: [number, number][] = [];
  out.forEach((sheet, p) => sheet.forEach((slot, k) => slot === null && empty.push([p, k])));
  empty.forEach(([p, k], j) => {
    out[p][k] = { cardIndex: (((amount - empty.length + j) % amount) + amount) % amount, sample: true };
  });
  return out as Slot[][];
}

/**
 * The cards on a type's test sheets (D306), by index: its last `perSheet × sheets` cards in number order (all of them
 * when it has fewer), so they fill the test sheets with no sample.
 */
export function testSheetCardIndexes(amount: number, perSheet: number, sheets: number): number[] {
  for (const [name, n, min] of [['amount', amount, 0], ['places a sheet', perSheet, 1], ['test sheets', sheets, 0]] as const) {
    if (!Number.isInteger(n) || n < min) throw new Error(`testSheetCardIndexes: the ${name} must be a whole number from ${min} (got ${n})`);
  }
  const count = Math.min(amount, perSheet * sheets);
  return Array.from({ length: count }, (_, i) => amount - count + i);
}

/** A type's cards on its test sheets: the very cards of its run (the same numbers, songs and QR), its last ones. */
export function testSheetCards<T>(cards: readonly T[], perSheet: number, sheets: number): T[] {
  return testSheetCardIndexes(cards.length, perSheet, sheets).map((i) => cards[i]);
}

/** How many places hold samples, over all the sheets. */
export const sampleCount = (sheets: readonly (readonly Slot[])[]): number => sheets.reduce((n, sheet) => n + sheet.filter((s) => s.sample).length, 0);

/**
 * A page's rows: the sheet's places cut into rows of `cols`, each row reversed on any side after the first (the back
 * of a duplex sheet, flipped on its long edge), so a card's back is printed behind its front.
 */
export function sideRows<T>(places: readonly T[], cols: number, side: number): T[][] {
  if (!Number.isInteger(cols) || cols < 1) throw new Error(`sideRows: the columns must be a whole number from 1 (got ${cols})`);
  const rows: T[][] = [];
  for (let i = 0; i < places.length; i += cols) {
    const row = places.slice(i, i + cols);
    rows.push(side > 1 ? row.reverse() : row);
  }
  return rows;
}

/** The PDF's pages in print order: each sheet's sides one after another (side 1, side 2, then the next sheet). */
export function printPages<S>(sheets: readonly S[], sides: readonly number[]): { sheet: S; sheetIndex: number; side: number }[] {
  return sheets.flatMap((sheet, sheetIndex) => sides.map((side) => ({ sheet, sheetIndex, side })));
}
