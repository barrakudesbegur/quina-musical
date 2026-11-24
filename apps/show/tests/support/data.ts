// Whether the prepared data is there (data/out from `npm run prep`, and the printed cards). It is gitignored or
// copyrighted-derived, so a fresh clone and CI have none: the tests that need it are skipped, with the reason,
// and `npm test` stays one command everywhere.
import fs from 'node:fs';
import path from 'node:path';
import nodeTest from 'node:test';
import { OUT, REPO } from '../../relay/pool.ts';

export const HAS_DATA = fs.existsSync(path.join(OUT, 'analysis', 'index.json')) && fs.existsSync(path.join(REPO, 'apps/cards/dist/cards.json'));
export const NO_DATA = 'no prepared data (data/out): run npm run prep';

/** node:test's `test` for a test that needs the prepared data: skipped, with the reason, when it is missing. */
export const dataTest = ((name: string, ...rest: unknown[]) => {
  if (HAS_DATA) return (nodeTest as (...args: unknown[]) => unknown)(name, ...rest);
  return nodeTest(name, { skip: NO_DATA }, () => {});
}) as typeof nodeTest;

/** Without the data, a stand-in card so a test file's setup can still run (its tests are skipped anyway). */
export const NO_CARD = Object.freeze({ id: 1, type: 'normal', lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] });
