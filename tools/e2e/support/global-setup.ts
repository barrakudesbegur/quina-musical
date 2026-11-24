// Build every page once (the relay serves the build with --dist), unless the prepared pool is missing anyway.
import { execFileSync } from 'node:child_process';
import { SHOW, hasPreparedPool } from './relay.ts';

export default function globalSetup(): void {
  if (!hasPreparedPool()) return;
  execFileSync('npm', ['run', 'build'], { cwd: SHOW, stdio: 'inherit' });
}
