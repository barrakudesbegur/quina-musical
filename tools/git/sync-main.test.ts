// sync-main against throwaway repositories: an origin (bare), the shared checkout with uncommitted work in it, and
// a second clone that pushes (like a session committing from a worktree).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncMain } from './sync-main.ts';

// Nobody's own git config (hooks, signing, templates) in these repositories.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function write(dir: string, file: string, text: string): void {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
}
const read = (dir: string, file: string): string => fs.readFileSync(path.join(dir, file), 'utf8');

function commit(dir: string, message: string, files: Record<string, string | null>, author = 'Sound engine <engine@example.com>'): string {
  for (const [file, text] of Object.entries(files)) {
    if (text === null) git(dir, 'rm', '-q', file);
    else {
      write(dir, file, text);
      git(dir, 'add', file);
    }
  }
  git(dir, 'commit', '-q', `--author=${author}`, '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}

/** origin with one commit, the shared checkout and a pusher, both cloned from it. */
function setup(): { origin: string; shared: string; pusher: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-sync-main-'));
  const origin = path.join(root, 'origin.git');
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  const seed = path.join(root, 'seed');
  git(root, 'init', '-q', '-b', 'main', seed);
  for (const dir of [seed]) {
    git(dir, 'config', 'user.name', 'Test');
    git(dir, 'config', 'user.email', 'test@example.com');
  }
  commit(seed, 'base', { 'a.txt': 'a\n', 'b.txt': 'b\n', 'docs/d.txt': 'd\n', '.gitignore': 'node_modules\n' });
  git(seed, 'remote', 'add', 'origin', origin);
  git(seed, 'push', '-q', 'origin', 'main');
  const clone = (name: string) => {
    const dir = path.join(root, name);
    git(root, 'clone', '-q', origin, dir);
    git(dir, 'config', 'user.name', 'Test');
    git(dir, 'config', 'user.email', 'test@example.com');
    return dir;
  };
  return { origin, shared: clone('shared'), pusher: clone('pusher') };
}

/** `git status --porcelain`, its leading spaces kept (" M" is a working-tree change, "M " a staged one). */
const status = (dir: string): string => execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).trimEnd();

test('behind origin: the incoming files update, uncommitted work elsewhere is untouched', () => {
  const { shared, pusher } = setup();
  commit(pusher, 'docs', { 'docs/d.txt': 'd2\n', 'docs/new.txt': 'new\n' });
  git(pusher, 'push', '-q', 'origin', 'main');
  write(shared, 'b.txt', 'b, being edited\n');

  const result = syncMain({ cwd: shared });
  assert.equal(result.kind, 'synced');
  assert.equal(git(shared, 'rev-parse', 'main'), git(shared, 'rev-parse', 'origin/main'));
  assert.equal(read(shared, 'docs/d.txt'), 'd2\n');
  assert.equal(read(shared, 'docs/new.txt'), 'new\n');
  assert.equal(read(shared, 'b.txt'), 'b, being edited\n');
  assert.equal(status(shared), ' M b.txt');
});

test('diverged: local commits are replayed onto origin with their author and message; work in progress stays', () => {
  const { shared, pusher } = setup();
  commit(pusher, 'Timeline', { 'docs/d.txt': 'd2\n' }, 'Orchestrator <orchestrator@example.com>');
  git(pusher, 'push', '-q', 'origin', 'main');
  const mine = commit(shared, 'Card type, step B\n\nWith a body.\n\nCo-Authored-By: Someone <s@example.com>', { 'a.txt': 'a, card types\n' });
  write(shared, 'b.txt', 'b, being edited\n');
  write(shared, 'untracked.txt', 'scratch\n');

  const result = syncMain({ cwd: shared });
  assert.equal(result.kind, 'synced');
  if (result.kind !== 'synced') return;
  assert.equal(result.replayed.length, 1);
  assert.equal(result.replayed[0]?.from, mine);
  // A push would publish the replayed commit (under its new hash).
  assert.deepEqual(result.publishes.map((c) => c.subject), ['Card type, step B']);
  const head = git(shared, 'rev-parse', 'main');
  assert.equal(git(shared, 'rev-parse', 'main^'), git(shared, 'rev-parse', 'origin/main'), 'linear on top of origin');
  assert.equal(git(shared, 'log', '-1', '--format=%an <%ae>%n%B', head), git(shared, 'log', '-1', '--format=%an <%ae>%n%B', mine));
  assert.equal(git(shared, 'log', '-1', '--format=%at', head), git(shared, 'log', '-1', '--format=%at', mine), 'the author date is kept');
  assert.equal(read(shared, 'docs/d.txt'), 'd2\n');
  assert.equal(read(shared, 'a.txt'), 'a, card types\n');
  assert.equal(read(shared, 'b.txt'), 'b, being edited\n');
  assert.equal(status(shared), ' M b.txt\n?? untracked.txt');
});

test("an incoming change to a file someone is editing: refused, and nothing moves", () => {
  const { shared, pusher } = setup();
  commit(pusher, 'docs', { 'b.txt': 'b from origin\n' });
  git(pusher, 'push', '-q', 'origin', 'main');
  commit(shared, 'mine', { 'a.txt': 'a2\n' });
  const before = git(shared, 'rev-parse', 'main');
  write(shared, 'b.txt', 'b, being edited\n');

  const result = syncMain({ cwd: shared });
  assert.equal(result.kind, 'refused');
  if (result.kind !== 'refused') return;
  assert.deepEqual(result.files, ['b.txt (uncommitted edits)']);
  assert.equal(git(shared, 'rev-parse', 'main'), before);
  assert.equal(read(shared, 'b.txt'), 'b, being edited\n');
});

test('an uncommitted edit identical to what origin brings (the .gitignore case) folds in: the file shows clean', () => {
  const { shared, pusher } = setup();
  commit(pusher, 'ignore temp', { '.gitignore': 'node_modules\n/temp/\n' });
  git(pusher, 'push', '-q', 'origin', 'main');
  commit(shared, 'mine', { 'a.txt': 'a2\n' });
  write(shared, '.gitignore', 'node_modules\n/temp/\n');

  assert.equal(syncMain({ cwd: shared }).kind, 'synced');
  assert.equal(status(shared), '');
});

test('a local commit that conflicts with origin: refused, nothing changed', () => {
  const { shared, pusher } = setup();
  commit(pusher, 'theirs', { 'a.txt': 'theirs\n' });
  git(pusher, 'push', '-q', 'origin', 'main');
  commit(shared, 'mine', { 'a.txt': 'mine\n' });
  const before = git(shared, 'rev-parse', 'main');

  const result = syncMain({ cwd: shared });
  assert.equal(result.kind, 'refused');
  if (result.kind !== 'refused') return;
  assert.match(result.reason, /conflicts with origin\/main/);
  assert.deepEqual(result.files, ['a.txt']);
  assert.equal(git(shared, 'rev-parse', 'main'), before);
  assert.equal(read(shared, 'a.txt'), 'mine\n');
});

test('only ahead, or already there: nothing to do', () => {
  const { shared } = setup();
  assert.deepEqual(syncMain({ cwd: shared }), { kind: 'upToDate' });
  const mine = commit(shared, 'mine', { 'a.txt': 'a2\n' });
  assert.deepEqual(syncMain({ cwd: shared }), { kind: 'ahead', commits: 1, publishes: [{ sha: mine, subject: 'mine' }] });
});

test('a dry run says what it would do and changes nothing', () => {
  const { shared, pusher } = setup();
  commit(pusher, 'docs', { 'docs/d.txt': 'd2\n' });
  git(pusher, 'push', '-q', 'origin', 'main');
  commit(shared, 'mine', { 'a.txt': 'a2\n' });
  const before = git(shared, 'rev-parse', 'main');

  const result = syncMain({ cwd: shared, dryRun: true });
  assert.equal(result.kind, 'synced');
  if (result.kind !== 'synced') return;
  assert.deepEqual(result.files, ['docs/d.txt']);
  assert.equal(git(shared, 'rev-parse', 'main'), before);
  assert.equal(read(shared, 'docs/d.txt'), 'd\n');
});

test('deletions, new folders and executable files come in as origin has them; empty folders go', () => {
  const { shared, pusher } = setup();
  commit(pusher, 'tools', { 'docs/d.txt': null, 'tools/run.sh': '#!/bin/sh\necho hi\n' });
  fs.chmodSync(path.join(pusher, 'tools/run.sh'), 0o755);
  git(pusher, 'add', 'tools/run.sh');
  git(pusher, 'commit', '-q', '-m', 'executable');
  git(pusher, 'push', '-q', 'origin', 'main');
  commit(shared, 'mine', { 'a.txt': 'a2\n' });

  assert.equal(syncMain({ cwd: shared }).kind, 'synced');
  assert.equal(fs.existsSync(path.join(shared, 'docs')), false, 'the emptied folder is gone');
  assert.equal(read(shared, 'tools/run.sh'), '#!/bin/sh\necho hi\n');
  assert.ok(fs.statSync(path.join(shared, 'tools/run.sh')).mode & 0o100, 'executable');
  assert.equal(status(shared), '');
});

test('a local commit origin already has (someone pushed the same change) is left out', () => {
  const { shared, pusher } = setup();
  commit(pusher, 'the same fix', { 'a.txt': 'fixed\n' });
  commit(pusher, 'and more', { 'docs/d.txt': 'd2\n' });
  git(pusher, 'push', '-q', 'origin', 'main');
  commit(shared, 'the same fix, here', { 'a.txt': 'fixed\n' });

  const result = syncMain({ cwd: shared });
  assert.equal(result.kind, 'synced');
  if (result.kind !== 'synced') return;
  assert.equal(result.replayed.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(git(shared, 'rev-parse', 'main'), git(shared, 'rev-parse', 'origin/main'));
  assert.equal(status(shared), '');
});

test('a local commit origin has as the same patch, edited again since on origin, is left out, not a conflict', () => {
  const { shared, pusher } = setup();
  // The same handoff line committed here, and pushed from elsewhere; then origin edits that line again.
  commit(shared, 'handoff, here', { 'docs/d.txt': 'd\nstep 1 waits\n' });
  const mine = commit(shared, 'my own work', { 'b.txt': 'b2\n' });
  commit(pusher, 'handoff, pushed', { 'docs/d.txt': 'd\nstep 1 waits\n' });
  commit(pusher, 'handoff, later', { 'docs/d.txt': 'd\nstep 1 is out\n' });
  git(pusher, 'push', '-q', 'origin', 'main');

  const result = syncMain({ cwd: shared });
  assert.equal(result.kind, 'synced', result.kind === 'refused' ? result.reason : '');
  if (result.kind !== 'synced') return;
  assert.deepEqual(result.skipped.map((c) => c.subject), ['handoff, here']);
  assert.deepEqual(result.replayed.map((c) => [c.from, c.subject]), [[mine, 'my own work']]);
  assert.equal(read(shared, 'docs/d.txt'), 'd\nstep 1 is out\n', 'origin\'s later edit stays');
  assert.equal(read(shared, 'b.txt'), 'b2\n');
  assert.equal(status(shared), '');
});

test('not on main, or mid-merge: refused', () => {
  const { shared } = setup();
  git(shared, 'checkout', '-q', '-b', 'other');
  assert.equal(syncMain({ cwd: shared }).kind, 'refused');
  git(shared, 'checkout', '-q', 'main');
  fs.writeFileSync(path.join(shared, '.git', 'MERGE_HEAD'), git(shared, 'rev-parse', 'HEAD'));
  const result = syncMain({ cwd: shared });
  assert.equal(result.kind, 'refused');
  if (result.kind === 'refused') assert.match(result.reason, /MERGE_HEAD/);
});
