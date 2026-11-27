// R4 and R5 on a tap (§8 Y3): a design-system control draws its own press and focus, and nothing of an app's generic
// button look may reach it. The phone's tap on «Sons» showed the player's old pressed look (a dark veil and bottom
// line) round the Switch's row, read as a black outline. Every component's <button> carries `data-touch`, and the
// apps' generic button rules leave `[data-touch]` alone; the Switch also cancels any pressed look itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../../../../..');
const COMPONENTS = path.join(REPO, 'packages/ui/components');

test('every component that renders a <button> marks it with data-touch', () => {
  const missing = readdirSync(COMPONENTS)
    .filter((name) => name.endsWith('.svelte'))
    .filter((name) => {
      const text = readFileSync(path.join(COMPONENTS, name), 'utf8');
      return text.includes('<button') && !text.includes('data-touch');
    });
  assert.deepEqual(missing, []);
});

test("the player's generic button look and press skip the design system's controls", () => {
  const css = readFileSync(path.join(REPO, 'apps/player/player.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const generic = css.split('\n').filter((line) => /^:where\(\.player\) button\b/.test(line));
  assert.ok(generic.length >= 2, 'the generic rules are where this test looks for them');
  for (const line of generic) assert.match(line, /:not\(\[data-touch\]\)/, line);
});

test('the Switch cancels any pressed look on its row (no veil, no edge, no dip)', () => {
  const css = readFileSync(path.join(COMPONENTS, 'switch.css'), 'utf8');
  const rule = css.match(/\.switch:active:not\(:disabled\) \{([^}]*)\}/)?.[1] ?? '';
  for (const declaration of ['transform: none', 'box-shadow: none', 'background: none']) assert.ok(rule.includes(declaration), declaration);
});
