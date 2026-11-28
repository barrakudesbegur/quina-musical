// The night's two Chrome windows and their profiles (docs/night-runbook.md, steps 5 and 7). Each runs from its
// own profile folder in ~/Library/Application Support/Quina/, which survives a restart; macOS empties /tmp at
// every boot. The show page keeps its own copy of the Game, its display offset and the Interval's place there;
// the laptop's console keeps the Wii remote's WebHID grant and the latest resume code.
// Node's own modules only: tools/laptop/setup.ts imports this before npm ci.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type ChromeWindow = 'show' | 'console';

/** Where the profiles live, under the user's home. */
export const PROFILES_DIR = 'Library/Application Support/Quina';

/** The two profile folders under `home`. */
export function chromeProfiles(home: string = os.homedir()): Record<ChromeWindow, string> {
  const base = path.join(home, PROFILES_DIR);
  return { show: path.join(base, 'chrome-show'), console: path.join(base, 'chrome-console') };
}

export const CHROME_PROFILES = chromeProfiles();

/** No first-run screens or default-browser prompt in a new profile (the kiosk window is on the projector). */
export const FIRST_RUN_FLAGS = ['--no-first-run', '--no-default-browser-check'] as const;

/**
 * Chrome must keep the show page's timers running even when its window isn't in front: a throttled page starves
 * the engine's lookahead (a hidden tab's timers fire once a minute after five minutes).
 */
export const SHOW_CHROME_FLAGS = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] as const;

/** The show page plays without a click. */
export const AUTOPLAY_FLAG = '--autoplay-policy=no-user-gesture-required';

/** The runbook's commands, as typed in a terminal (`$HOME` in double quotes: zsh expands neither `~` after `=` nor across a space). */
export const RUNBOOK_COMMANDS: Record<ChromeWindow, string> = {
  show: `open -na "Google Chrome" --args --user-data-dir="$HOME/${PROFILES_DIR}/chrome-show" ${FIRST_RUN_FLAGS.join(' ')} ${AUTOPLAY_FLAG} ${SHOW_CHROME_FLAGS.join(' ')} --kiosk "http://localhost:5174/show/?autostart=1"`,
  console: `open -na "Google Chrome" --args --user-data-dir="$HOME/${PROFILES_DIR}/chrome-console" ${FIRST_RUN_FLAGS.join(' ')} --app=http://localhost:5174/console/`,
};

/** A line of `ps -axo command` that is a Chrome browser process (not a helper, which carries the same flags). */
export function isChromeMain(line: string): boolean {
  return /Google Chrome\.app\/Contents\/MacOS\/Google Chrome(\s|$)/.test(line);
}

/**
 * The `--user-data-dir` of a `ps -axo command` line, or null without one. ps joins the arguments with spaces and
 * no quoting, so a value with spaces ("Application Support") runs up to the next ` --` or ` http`, or the end.
 */
export function userDataDir(line: string): string | null {
  const match = /--user-data-dir=(.*?)(?= --| https?:|$)/.exec(line);
  if (!match) return null;
  const value = (match[1] ?? '').trim().replace(/^(["'])(.*)\1$/, '$2');
  return value || null;
}

/** The folders macOS empties: /tmp (and its real path) and the user's temporary folder. */
export function temporaryDirs(): string[] {
  const dirs = ['/tmp', '/private/tmp', os.tmpdir()];
  try {
    dirs.push(fs.realpathSync(os.tmpdir()));
  } catch {
    // no real path: os.tmpdir() as it is
  }
  return [...new Set(dirs.map((d) => d.replace(/\/+$/, '')))];
}

/** Whether `dir` is inside one of `tmpDirs`. */
export function isTemporary(dir: string, tmpDirs: readonly string[]): boolean {
  return tmpDirs.some((t) => dir === t || dir.startsWith(`${t}/`));
}

export interface ProfileFolder {
  window: ChromeWindow;
  dir: string;
  /** `created` now; `there` already; `tightened`: it was there, readable by others, and is now private (700). */
  state: 'created' | 'there' | 'tightened';
}

/** Make both profile folders private to this user (700). Safe to run again. */
export function ensureChromeProfiles(profiles: Record<ChromeWindow, string> = CHROME_PROFILES): ProfileFolder[] {
  return (Object.entries(profiles) as [ChromeWindow, string][]).map(([window, dir]) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.chmodSync(dir, 0o700);
      return { window, dir, state: 'created' };
    }
    if ((fs.statSync(dir).mode & 0o077) !== 0) {
      fs.chmodSync(dir, 0o700);
      return { window, dir, state: 'tightened' };
    }
    return { window, dir, state: 'there' };
  });
}
