// Bring the shared checkout's `main` up to `origin/main` without touching anyone's work in progress:
//
//   npm run sync-main                  fetch, replay main's local commits onto origin/main, update changed files
//   npm run sync-main -- --dry-run     say what it would do, change nothing
//   npm run sync-main -- --no-fetch    use the origin/main already fetched
//
// Why: several sessions share one checkout of `main` with uncommitted edits in it, while others commit from
// worktrees and push. `git pull --rebase --autostash` would stash and reset everyone's files mid-edit. This:
//   1. fetches origin/main;
//   2. replays main's local commits (those not on origin yet) onto origin/main in git's object store only:
//      `git merge-tree --write-tree` plus `git commit-tree` is a cherry-pick that never touches the working
//      tree or the index. Each replayed commit keeps its author, date and message (its hash changes);
//   3. checks every file the incoming commits change: it must be in the working tree and the index as main
//      has it (nobody's edit), or already exactly as it will be. Otherwise it stops before changing anything
//      and names the files;
//   4. moves main with `git update-ref`, only if nobody committed in the meantime;
//   5. writes only those files, and their index entries. Nothing else in the working tree is touched.
// It never pushes: run the tests on the committed state, then `git push origin main`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface SyncOptions {
  /** Any folder inside the checkout. */
  cwd: string;
  /** Fetch origin first (default true). */
  fetch?: boolean;
  /** Plan only: change nothing (default false). */
  dryRun?: boolean;
}

export interface Replayed {
  from: string;
  to: string;
  subject: string;
}

export type SyncResult =
  | { kind: 'upToDate' }
  | { kind: 'ahead'; commits: number }
  | {
      kind: 'synced';
      dryRun: boolean;
      from: string;
      to: string;
      /** Local commits replayed onto origin/main, old hash → new hash. */
      replayed: Replayed[];
      /** Local commits whose change origin/main already has (left out). */
      skipped: Replayed[];
      /** Files brought in from origin/main (written, deleted, or already as origin has them). */
      files: string[];
    }
  | { kind: 'refused'; reason: string; files?: string[] };

const BRANCH = 'refs/heads/main';
const UPSTREAM = 'refs/remotes/origin/main';
const EMPTY = '0'.repeat(40);

interface Run {
  status: number;
  out: string;
  err: string;
}

function run(cwd: string, args: string[], input?: string | Buffer, env?: NodeJS.ProcessEnv): Run {
  const r = spawnSync('git', args, { cwd, input, env: env ?? process.env, maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw r.error;
  return { status: r.status ?? 1, out: r.stdout.toString('utf8'), err: r.stderr.toString('utf8') };
}

/** Run git and return its trimmed output; throw on failure (an unexpected state, not a refusal). */
function git(cwd: string, args: string[], input?: string | Buffer, env?: NodeJS.ProcessEnv): string {
  const r = run(cwd, args, input, env);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.err.trim() || r.out.trim()}`);
  return r.out.trim();
}

/** One path that differs between main and the synced tip. */
interface Change {
  path: string;
  oldMode: string;
  newMode: string;
  oldSha: string;
  newSha: string;
}

/** `git diff-tree -r -z --no-renames a b`, parsed. */
function changes(cwd: string, from: string, to: string): Change[] {
  const raw = run(cwd, ['diff-tree', '-r', '-z', '--no-renames', from, to]);
  if (raw.status !== 0) throw new Error(`git diff-tree failed: ${raw.err.trim()}`);
  const parts = raw.out.split('\0');
  const list: Change[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const meta = parts[i] ?? '';
    const file = parts[i + 1] ?? '';
    const [oldMode = '', newMode = '', oldSha = '', newSha = ''] = meta.replace(/^:/, '').split(' ');
    list.push({ path: file, oldMode, newMode, oldSha, newSha });
  }
  return list;
}

/** What the working tree holds at `file`: absent, or the blob hash it would have (symlinks hash their target). */
function workingSha(top: string, file: string): string {
  const full = path.join(top, file);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(full);
  } catch {
    return EMPTY;
  }
  if (stat.isSymbolicLink()) return git(top, ['hash-object', '--no-filters', '--stdin'], fs.readlinkSync(full));
  if (stat.isDirectory()) return 'directory';
  return git(top, ['hash-object', `--path=${file}`, '--', file]);
}

/** The index's entry for `file`: absent, its blob, or 'conflict' while a merge is unresolved there. */
function indexSha(top: string, file: string): string {
  const out = run(top, ['ls-files', '-s', '-z', '--', file]).out;
  const entries = out.split('\0').filter((e) => e.endsWith(`\t${file}`));
  if (entries.length === 0) return EMPTY;
  if (entries.length > 1) return 'conflict';
  const [, sha = '', stage = ''] = (entries[0] ?? '').split('\t')[0]?.split(' ') ?? [];
  return stage === '0' ? sha : 'conflict';
}

/** The author and exact message of a commit, to replay it as it was. */
function commitParts(cwd: string, sha: string): { env: NodeJS.ProcessEnv; message: string } {
  const raw = git(cwd, ['cat-file', 'commit', sha]) + '\n';
  const split = raw.indexOf('\n\n');
  const header = raw.slice(0, split);
  const message = raw.slice(split + 2);
  const author = /^author (.*) <(.*)> (\d+) ([+-]\d{4})$/m.exec(header);
  if (!author) throw new Error(`commit ${sha} has no author line`);
  const [, name = '', email = '', seconds = '', zone = ''] = author;
  return { env: { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: `${seconds} ${zone}` }, message };
}

/** Remove a deleted file's folders while they are empty, up to the checkout's top. */
function pruneEmptyParents(top: string, file: string): void {
  let dir = path.dirname(path.join(top, file));
  while (dir.startsWith(top + path.sep)) {
    try {
      fs.rmdirSync(dir); // only succeeds when empty
    } catch {
      return;
    }
    dir = path.dirname(dir);
  }
}

export function syncMain({ cwd, fetch = true, dryRun = false }: SyncOptions): SyncResult {
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  const head = run(top, ['symbolic-ref', '-q', 'HEAD']).out.trim();
  if (head !== BRANCH) return { kind: 'refused', reason: `this checkout is on ${head || 'a detached HEAD'}, not main` };
  const gitDir = path.resolve(top, git(top, ['rev-parse', '--git-dir']));
  const busy = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'].find((f) => fs.existsSync(path.join(gitDir, f)));
  if (busy) return { kind: 'refused', reason: `a git operation is in progress here (${busy}); finish or abort it first` };

  if (fetch) git(top, ['fetch', '--quiet', 'origin', 'main']);
  const local = git(top, ['rev-parse', BRANCH]);
  const upstream = git(top, ['rev-parse', UPSTREAM]);
  if (local === upstream) return { kind: 'upToDate' };
  const base = git(top, ['merge-base', local, upstream]);
  if (base === upstream) return { kind: 'ahead', commits: Number(git(top, ['rev-list', '--count', `${upstream}..${local}`])) };

  // ---- replay main's local commits onto origin/main, in the object store only ----------------------------
  const replayed: Replayed[] = [];
  const skipped: Replayed[] = [];
  let tip = upstream;
  const lines = git(top, ['rev-list', '--reverse', '--parents', `${base}..${local}`]).split('\n').filter(Boolean);
  for (const line of lines) {
    const [sha = '', ...parents] = line.split(' ');
    if (parents.length !== 1) return { kind: 'refused', reason: `local commit ${sha.slice(0, 7)} is a merge; replay it by hand` };
    const subject = git(top, ['log', '-1', '--format=%s', sha]);
    const merged = run(top, ['merge-tree', '--write-tree', '--name-only', `--merge-base=${parents[0]}`, tip, sha]);
    if (merged.status === 1) {
      const conflicted = merged.out.trim().split('\n').slice(1).filter((l) => l && !l.startsWith('Auto-merging') && !l.startsWith('CONFLICT'));
      return { kind: 'refused', reason: `local commit ${sha.slice(0, 7)} ("${subject}") conflicts with origin/main; nothing was changed`, files: conflicted };
    }
    if (merged.status !== 0) throw new Error(`git merge-tree failed: ${merged.err.trim()}`);
    const tree = merged.out.trim().split('\n')[0] ?? '';
    if (tree === git(top, ['rev-parse', `${tip}^{tree}`])) {
      skipped.push({ from: sha, to: tip, subject }); // origin/main already has this change
      continue;
    }
    const { env, message } = commitParts(top, sha);
    const next = git(top, ['commit-tree', tree, '-p', tip, '-F', '-'], message, env);
    replayed.push({ from: sha, to: next, subject });
    tip = next;
  }

  // ---- every file that changes in the working tree must be nobody's work in progress ---------------------
  const plan = changes(top, local, tip);
  const blocked: string[] = [];
  for (const c of plan) {
    if (c.oldMode === '160000' || c.newMode === '160000') {
      blocked.push(`${c.path} (a submodule)`);
      continue;
    }
    const inIndex = indexSha(top, c.path);
    if (inIndex !== c.oldSha && inIndex !== c.newSha) blocked.push(`${c.path} (staged changes)`);
    const inTree = workingSha(top, c.path);
    if (inTree !== c.oldSha && inTree !== c.newSha) blocked.push(`${c.path} (uncommitted edits)`);
  }
  if (blocked.length > 0) {
    return { kind: 'refused', reason: 'origin/main changes files that have uncommitted work here; nothing was changed. Commit or set that work aside, then run again', files: blocked };
  }
  const result: SyncResult = { kind: 'synced', dryRun, from: local, to: tip, replayed, skipped, files: plan.map((c) => c.path) };
  if (dryRun) return result;

  // ---- move main (only if nobody committed meanwhile), then write just those files -------------------------
  const moved = run(top, ['update-ref', '-m', 'sync-main: local commits replayed onto origin/main', BRANCH, tip, local]);
  if (moved.status !== 0) return { kind: 'refused', reason: 'main moved while syncing (someone committed); nothing was changed. Run again' };
  for (const c of plan) {
    const full = path.join(top, c.path);
    if (workingSha(top, c.path) === c.newSha) continue; // already as origin has it (or already gone)
    if (c.newSha === EMPTY) {
      fs.rmSync(full, { force: true });
      pruneEmptyParents(top, c.path);
      continue;
    }
    const blob = spawnSync('git', ['cat-file', 'blob', c.newSha], { cwd: top, maxBuffer: 256 * 1024 * 1024 }).stdout;
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.rmSync(full, { force: true });
    if (c.newMode === '120000') fs.symlinkSync(blob.toString('utf8'), full);
    else fs.writeFileSync(full, blob, { mode: c.newMode === '100755' ? 0o755 : 0o644 });
  }
  // The index follows: each path as it now is in the working tree (added, updated, or removed). Another session's
  // git command may hold the index lock for a moment: wait for it, up to a few seconds.
  if (plan.length > 0) {
    const paths = plan.map((c) => c.path).join('\0') + '\0';
    for (let attempt = 1; ; attempt++) {
      const indexed = run(top, ['update-index', '--add', '--remove', '-z', '--stdin'], paths);
      if (indexed.status === 0) break;
      if (!indexed.err.includes('index.lock') || attempt >= 50) {
        throw new Error(`main moved and the files are written, but the index wasn't updated (${indexed.err.trim()}). Fix it with: git reset -q -- ${plan.map((c) => c.path).join(' ')}`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  return result;
}

// ---- the command ---------------------------------------------------------------------------------------------
function main(): void {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== '--dry-run' && a !== '--no-fetch');
  if (unknown.length > 0) {
    console.error(`unknown option ${unknown.join(' ')}; usage: npm run sync-main -- [--dry-run] [--no-fetch]`);
    process.exit(2);
  }
  const result = syncMain({ cwd: process.cwd(), fetch: !args.includes('--no-fetch'), dryRun: args.includes('--dry-run') });
  const short = (sha: string) => sha.slice(0, 7);
  switch (result.kind) {
    case 'upToDate':
      console.log('main is already origin/main.');
      return;
    case 'ahead':
      console.log(`main is ${result.commits} commit(s) ahead of origin/main, nothing to bring in. Push once the tests pass.`);
      return;
    case 'refused':
      console.error(`sync-main refused: ${result.reason}.`);
      for (const f of result.files ?? []) console.error(`  ${f}`);
      process.exit(1);
      return;
    case 'synced': {
      const verb = result.dryRun ? 'would' : 'did';
      console.log(`${result.dryRun ? 'Dry run: ' : ''}main ${short(result.from)} → ${short(result.to)}.`);
      if (result.replayed.length > 0) {
        console.log(`Local commits replayed onto origin/main (new hashes: tell their sessions if they cite them):`);
        for (const r of result.replayed) console.log(`  ${short(r.from)} → ${short(r.to)}  ${r.subject}`);
      }
      for (const s of result.skipped) console.log(`  ${short(s.from)} left out: origin/main already has it  ${s.subject}`);
      console.log(`Files from origin/main (${verb} update; nothing else touched): ${result.files.length}`);
      for (const f of result.files) console.log(`  ${f}`);
      if (!result.dryRun && result.replayed.length > 0) console.log('Next: test the committed state, then git push origin main.');
    }
  }
}

if (import.meta.main) main();
