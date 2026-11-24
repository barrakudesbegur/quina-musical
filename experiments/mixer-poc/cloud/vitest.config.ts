// The Worker and the GameRoom, tested in workerd (Miniflare) with the real wrangler.jsonc. The dev Access bypass
// is on, as in `wrangler dev`; it only works on localhost URLs (test/node/access.test.ts covers the real checks).
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { ACCESS_DEV: 'true' } },
    }),
  ],
  test: {
    include: ['test/worker/**/*.test.ts'],
  },
});
