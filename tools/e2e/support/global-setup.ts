// Build every page once (the relay serves the build with --dist), unless the prepared repertoire is missing anyway.
import { execFileSync } from 'node:child_process';
import { SHOW, hasPreparedRepertoire } from './relay.ts';

export default function globalSetup(): void {
  if (!hasPreparedRepertoire()) return;
  execFileSync('npm', ['run', 'build'], { cwd: SHOW, stdio: 'inherit' });
}
