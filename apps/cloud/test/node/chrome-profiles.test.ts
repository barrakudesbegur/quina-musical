// The night's Chrome profiles: the ps-line parser, the folders setup:laptop makes, and the runbook's commands.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RUNBOOK_COMMANDS, chromeProfiles, ensureChromeProfiles, isChromeMain, isTemporary, temporaryDirs, userDataDir } from '../../laptop/chrome-profiles.ts';
import { CHROME, HELPER, psLine } from '../support/chrome.ts';
import { tempDir } from '../support/temp.ts';

test('the runbook has these exact commands', () => {
  const runbook = fs.readFileSync(path.join(import.meta.dirname, '../../../../docs/night-runbook.md'), 'utf8');
  assert.ok(runbook.includes(`\`${RUNBOOK_COMMANDS.show}\``), 'step 5');
  assert.ok(runbook.includes(`\`${RUNBOOK_COMMANDS.console}\``), 'step 7 and "Without the tablet"');
});

test('userDataDir: up to the next flag or address, spaces included', () => {
  const show = psLine(RUNBOOK_COMMANDS.show);
  assert.equal(userDataDir(show), '/Users/tech/Library/Application Support/Quina/chrome-show');
  assert.equal(userDataDir(psLine(RUNBOOK_COMMANDS.console)), '/Users/tech/Library/Application Support/Quina/chrome-console');
  // Last year's command, unquoted /tmp.
  assert.equal(userDataDir(`${CHROME} --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required --kiosk http://localhost:5174/show/?autostart=1`), '/tmp/quina-show');
  // The address right after it, or nothing after it.
  assert.equal(userDataDir(`${CHROME} --user-data-dir=/tmp/quina-console http://localhost:5174/console/`), '/tmp/quina-console');
  assert.equal(userDataDir(`${CHROME} --app=http://localhost:5174/console/ --user-data-dir=/Users/tech/Library/Application Support/Quina/chrome-console`), '/Users/tech/Library/Application Support/Quina/chrome-console');
  // A value somebody quoted by hand (a script that escaped the quotes).
  assert.equal(userDataDir(`${CHROME} --user-data-dir="/Users/tech/My Profiles/show" --kiosk`), '/Users/tech/My Profiles/show');
  // A helper carries the same flag; the parser reads it, isChromeMain leaves the helper out.
  const helper = `${HELPER} --type=gpu-process --gpu-recent-crash-count=0 --user-data-dir=/Users/tech/Library/Application Support/Quina/chrome-show --gpu-preferences=WAAAAAAAAACgAACBAAAAAAAAAAAAAGAAQA`;
  assert.equal(userDataDir(helper), '/Users/tech/Library/Application Support/Quina/chrome-show');
  assert.equal(isChromeMain(helper), false);
  assert.equal(isChromeMain(show), true);
  assert.equal(isChromeMain(CHROME), true);
  // None, or an empty one.
  assert.equal(userDataDir(`${CHROME} --profile-directory=Default`), null);
  assert.equal(userDataDir(`${CHROME} --user-data-dir= --kiosk`), null);
});

test('temporary folders: /tmp, its real path and the user\'s temporary folder', () => {
  const tmp = temporaryDirs();
  for (const dir of ['/tmp/quina-show', '/private/tmp/quina-show', path.join(os.tmpdir(), 'quina-console')]) assert.ok(isTemporary(dir, tmp), dir);
  assert.equal(isTemporary('/Users/tech/Library/Application Support/Quina/chrome-show', tmp), false);
  assert.equal(isTemporary('/tmpfiles/show', ['/tmp']), false, 'a prefix of a name is not a parent folder');
});

test('ensureChromeProfiles: makes both folders private (700), and is safe to run again', () => {
  const home = tempDir('quina-home-');
  const profiles = chromeProfiles(home);
  assert.equal(profiles.show, path.join(home, 'Library/Application Support/Quina/chrome-show'));
  assert.deepEqual(ensureChromeProfiles(profiles).map((f) => [f.window, f.state]), [['show', 'created'], ['console', 'created']]);
  for (const dir of Object.values(profiles)) assert.equal(fs.statSync(dir).mode & 0o777, 0o700, dir);
  assert.deepEqual(ensureChromeProfiles(profiles).map((f) => f.state), ['there', 'there']);
  fs.chmodSync(profiles.console, 0o755);
  assert.deepEqual(ensureChromeProfiles(profiles).map((f) => f.state), ['there', 'tightened']);
  assert.equal(fs.statSync(profiles.console).mode & 0o777, 0o700);
});
