import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const isWindows = process.platform === 'win32';
const forwarded = process.argv.slice(2);
const cleanEnv = { ...process.env };

for (const key of [
  'npm_config_prefix',
  'npm_lifecycle_event',
  'npm_lifecycle_script',
  'npm_package_json',
  'npm_package_name',
  'npm_package_version'
]) delete cleanEnv[key];

const result = spawnSync('npm', ['run', 'system:check', '--', ...forwarded], {
  cwd: resolve(process.cwd(), 'backend'),
  stdio: 'inherit',
  windowsHide: true,
  shell: isWindows,
  env: cleanEnv
});

if (result.error) {
  console.error(`Could not start the backend system check: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

