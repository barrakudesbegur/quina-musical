// Temporary folders for tests, removed when the test's process exits (node --test runs each file in its own), so
// runs never pile up in the system temp folder. They did: about 5,500 folders, 2 GB, by 27 Nov.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const made: string[] = [];

export function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  if (made.length === 0) process.once('exit', () => made.forEach((at) => fs.rmSync(at, { recursive: true, force: true })));
  made.push(dir);
  return dir;
}
