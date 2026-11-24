// Images: JPEG XL first where the browser reads it, a PNG or JPEG fallback, never WebP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageSources } from '../../../../packages/ui/data/media.ts';

test('uploaded media offer their JPEG XL next to the fallback', () => {
  assert.deepEqual(imageSources('/media/ab12cd.png'), { jxl: '/media/ab12cd.jxl', src: '/media/ab12cd.png' });
  assert.deepEqual(imageSources('/media/ab12cd.jpg'), { jxl: '/media/ab12cd.jxl', src: '/media/ab12cd.jpg' });
});

test('anything else is shown as it is', () => {
  assert.equal(imageSources('data:image/png;base64,AAAA').jxl, null);
  assert.equal(imageSources('/media/old.webp').jxl, null);
  assert.equal(imageSources('/logos/forn.png').jxl, null);
  assert.equal(imageSources('/media/a/b.png').jxl, null, 'only flat media keys');
});
