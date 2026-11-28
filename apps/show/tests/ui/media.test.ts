// Images: JPEG XL first where the browser reads it, a PNG or JPEG fallback, never WebP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageSources } from '../../../../packages/ui/data/media.ts';

test('uploaded media offer their JPEG XL next to the fallback', () => {
  assert.deepEqual(imageSources('/media/0123456789abcdef0123456789abcdef.png'), { jxl: '/media/0123456789abcdef0123456789abcdef.jxl', src: '/media/0123456789abcdef0123456789abcdef.png' });
  assert.deepEqual(imageSources('/media/0123456789abcdef0123456789abcdef.jpg'), { jxl: '/media/0123456789abcdef0123456789abcdef.jxl', src: '/media/0123456789abcdef0123456789abcdef.jpg' });
});

test('anything else is shown as it is', () => {
  assert.equal(imageSources('data:image/png;base64,AAAA').jxl, null);
  assert.equal(imageSources('/media/old.webp').jxl, null);
  assert.equal(imageSources('/logos/forn.png').jxl, null);
  assert.equal(imageSources('/media/a/b.png').jxl, null, 'only flat media keys');
});
