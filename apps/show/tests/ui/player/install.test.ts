// Installing the player as an app (D221): what Ajustos and the home offer, from what the browser says
// (logic/install.ts), and the iPhone's steps.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LINE_ICONS } from '../../../../../packages/ui/icons/line.ts';
import { homeOffersInstall, installOffer, installPlatform, installSteps, iosBrowser, type InstallFacts } from '../../../../player/logic/install.ts';
import { S } from '../../../../player/strings.ts';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.7444.46 Mobile/15E148 Safari/604.1';
const IPHONE_GOOGLE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/390.0.786 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';

const android: InstallFacts = { platform: 'other', standalone: false, installed: false, promptHeld: false };
const iphone: InstallFacts = { ...android, platform: 'ios' };

test('Android: «Instal·la l’app» only while Chrome holds a prompt, at home and in Ajustos', () => {
  assert.equal(installOffer(android), 'none');
  assert.equal(homeOffersInstall(installOffer(android)), false);
  assert.equal(installOffer({ ...android, promptHeld: true }), 'prompt');
  assert.equal(homeOffersInstall(installOffer({ ...android, promptHeld: true })), true);
});

test('installed: running as the app, or a tab that knows the app is there → «Ja tens l’app», no button', () => {
  for (const facts of [{ ...android, standalone: true }, { ...android, installed: true, promptHeld: true }, { ...iphone, standalone: true }]) {
    assert.equal(installOffer(facts), 'installed', JSON.stringify(facts));
    assert.equal(homeOffersInstall(installOffer(facts)), false);
  }
});

test('iPhones: only Ajustos, as the steps’ drawer; never a button at home', () => {
  assert.equal(installOffer(iphone), 'steps');
  assert.equal(homeOffersInstall('steps'), false);
});

test('the platform and the iPhone’s browser, from the user agent', () => {
  assert.equal(installPlatform(IPHONE_SAFARI, 5), 'ios');
  assert.equal(installPlatform(IPAD, 5), 'ios', 'an iPad says it is a Mac, with a touch screen');
  assert.equal(installPlatform(IPAD, 0), 'other', 'a real Mac');
  assert.equal(installPlatform(ANDROID, 5), 'other');
  assert.equal(iosBrowser(IPHONE_SAFARI), 'safari');
  assert.equal(iosBrowser(IPHONE_CHROME), 'other');
  assert.equal(iosBrowser(IPHONE_GOOGLE), 'other');
});

test('Safari’s shortest steps: ⋯ → Compartir → Afegir a la pantalla d’inici → Afegir, «Obrir com a app web» left on', () => {
  const steps = installSteps('safari', S.installSteps);
  assert.deepEqual(
    steps.map((s) => s.button),
    ['⋯', 'Compartir', 'Afegir a la pantalla d’inici', 'Afegir'],
  );
  assert.match(steps[3].text, /Obrir com a app web/);
  for (const step of steps) {
    assert.ok(step.icon in LINE_ICONS, step.icon);
    assert.equal(step.text.split('{}').length, 2, `one place for the button's name: ${step.text}`);
  }
});

test('another iPhone browser: Compartir is in its address bar, so one step fewer', () => {
  assert.deepEqual(
    installSteps('other', S.installSteps).map((s) => s.button),
    ['Compartir', 'Afegir a la pantalla d’inici', 'Afegir'],
  );
});
