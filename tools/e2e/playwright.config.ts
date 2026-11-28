// One whole show, headless (show.spec.ts). It needs the default repertoire prepared (data/out, data/cache: npm run prep
// in apps/show) and builds the pages first; without the prepared repertoire it skips. Locally it drives the installed
// Chrome; on CI (PLAYWRIGHT_BROWSERS=bundled) Playwright's own Chromium.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  globalSetup: './support/global-setup.ts',
  // One show at a time: a show page owns the relay.
  workers: 1,
  fullyParallel: false,
  timeout: 6 * 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'report' }]] : 'list',
  outputDir: 'results',
  use: {
    channel: process.env.PLAYWRIGHT_BROWSERS === 'bundled' ? undefined : 'chrome',
    headless: true,
    // Several pages run at once and only one has focus: keep the others' timers and rendering at full speed, as on
    // the night (the show page is the projector's foreground window there). Chrome otherwise throttles a hidden
    // page's timers to once a minute after five minutes, which stalls the show page mid-test.
    launchOptions: {
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=IntensiveWakeUpThrottling',
        // A fake audio sink: the engine's clock is the AudioContext's, and on 28 Nov this Mac's CoreAudio stopped
        // pulling Chrome's audio (currentTime moved 0.005 s in 2 s), so every run hung before the first landing. The
        // test checks the show's logic, never the sound, so its clock must not depend on the machine's output device.
        '--disable-audio-output',
      ],
    },
    trace: 'retain-on-failure',
  },
});
