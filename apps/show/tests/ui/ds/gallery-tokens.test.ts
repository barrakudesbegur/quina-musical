// The gallery's Tokens section (apps/ds/sections/tokens.ts) reads the same in development and in the gallery's build
// (the CSS order check compares them): a caption names an image by its source file, never by the build's hashed copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tidyValue } from '../../../../ds/sections/tokens.ts';

test("a url() names its file as the source does, in development and in the build's assets folder", () => {
  assert.equal(tidyValue("url('../../packages/ui/assets/ninos/nino-afro.svg')"), 'url(…/nino-afro.svg)');
  assert.equal(tidyValue("url('/assets/nino-afro-B8LgNj0y.svg')"), 'url(…/nino-afro.svg)', "the build's hash dropped");
  assert.equal(tidyValue("url('/assets/nino-fent-una-torre-C5Vc3v91.svg')"), 'url(…/nino-fent-una-torre.svg)');
  assert.equal(tidyValue("url('../../packages/ui/assets/ninos/nino-meditant.svg')"), 'url(…/nino-meditant.svg)', 'an 8-letter word outside the build stays');
  assert.equal(tidyValue('url(data:image/svg+xml;utf8,<svg/>) no-repeat'), 'url(data:image/svg+xml…) no-repeat');
});
