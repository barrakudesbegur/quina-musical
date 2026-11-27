// What the media sync's scan takes from a root: the playable files, never dot files, half-written ones, or a
// `_retired/` folder at any depth (songs a renumber dropped stay on the laptop only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scan } from '../../laptop/media-sync.ts';
import { tempDir } from '../support/temp.ts';

function write(base: string, rel: string, text = rel): void {
  fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
  fs.writeFileSync(path.join(base, rel), text);
}

test('the scan skips _retired folders at any depth, dot files and half-written files', async () => {
  const cache = tempDir('quina-scan-cache-');
  const covers = tempDir('quina-scan-covers-');
  const data = tempDir('quina-scan-data-');
  write(cache, '1/mix.flac');
  write(cache, '_retired/5MwUr7hf/mix.flac');
  write(cache, 'keys/_retired/9.json');
  write(cache, '2/.DS_Store');
  write(cache, '2/mix.flac.part');
  write(covers, '1.jpg');
  write(covers, '_retired/old.jpg');
  write(covers, 'not_retired/3.jpg');
  const files = await scan([{ root: 'cache', dir: cache }, { root: 'covers', dir: covers }], data);
  assert.deepEqual([...files.keys()].sort(), ['cache/1/mix.flac', 'covers/1.jpg', 'covers/not_retired/3.jpg']);
});
