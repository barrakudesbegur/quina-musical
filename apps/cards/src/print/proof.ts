// The proof for the print shop (D267): one file per type and paper size, since a shop's machine may not switch paper
// size inside one duplex job, and each type prints on its own paper colour. Each file says how to print it. Pure, and
// it imports only types, so the tests run it as it is.
import type { CardLayout } from './layouts';

/** A part of a proof: some sheets of one layout (the first A4 sheet, the A3 test sheet). */
export interface ProofPart<R> {
  layout: CardLayout;
  /** What the part holds, as the run prints it («the first A4 sheet, #1, #134, #267»). */
  what: string;
  /** The sheets it prints. */
  sheets: number;
  /** What the PDF renderer prints for it. */
  run: R;
}

export interface ProofFile<R> {
  /** `proof-<type>-<sheet>.pdf`, the sheet in lowercase: `proof-normal-a4.pdf`. */
  file: string;
  /** The paper size: «A4», «A3». */
  sheet: string;
  /** In page order. */
  parts: ProofPart<R>[];
  /** How the shop prints it: the paper, its colour, black and white or colour, duplex, 100 %. */
  print: string;
}

/**
 * A type's proof files: its parts grouped by paper size, in the order the sizes first come. `paper` is the colour of the
 * type's paper («blue», «pink», D267). A file is in colour when any of its parts prints covers.
 */
export function proofFiles<R>(type: string, paper: string, parts: readonly ProofPart<R>[]): ProofFile<R>[] {
  const files = new Map<string, ProofPart<R>[]>();
  for (const part of parts) files.set(part.layout.sheet.name, [...(files.get(part.layout.sheet.name) ?? []), part]);
  return [...files].map(([sheet, inFile]) => ({
    file: `proof-${type}-${sheet.toLowerCase()}.pdf`,
    sheet,
    parts: inFile,
    print: `${sheet}, ${paper} paper, ${inFile.some((p) => p.layout.covers) ? 'colour' : 'black and white'}, duplex long edge («dúplex, vora llarga»), at 100 %`,
  }));
}
