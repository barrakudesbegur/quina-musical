// Chrome's process lines as `ps -axo command` shows them (arguments joined by spaces, no quotes), for the
// preflight's Browser and Chrome profiles checks.

export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const HELPER = '/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/158.0.8127.37/Helpers/Google Chrome Helper (Aperitif).app/Contents/MacOS/Google Chrome Helper (Aperitif)';

/** What ps shows for a runbook command run by a user with this home. */
export function psLine(command: string, home = '/Users/tech'): string {
  return `${CHROME} ${command.replace('open -na "Google Chrome" --args ', '').replaceAll('$HOME', home).replaceAll('"', '')}`;
}
