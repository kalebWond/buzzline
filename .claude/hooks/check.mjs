// Stop hook: uncommitted changes must pass `npm run check` before Claude finishes.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
if (input.stop_hook_active) process.exit(0); // already sent back once, so let it stop

const start = input.cwd || process.cwd();
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' });
const root = run('git rev-parse --show-toplevel', start).trim();

if (!run('git status --porcelain', root).trim()) process.exit(0); // nothing changed

try {
  run('npm run check', root);
} catch (e) {
  const output = `${e.stdout ?? ''}\n${e.stderr ?? ''}`.slice(-3000);
  console.error(`npm run check failed. Fix this before finishing:\n${output}`);
  process.exit(2); // exit code 2 sends Claude back to work
}