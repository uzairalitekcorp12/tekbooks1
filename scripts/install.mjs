import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const isWindows = process.platform === 'win32';

function cleanNpmEnv() {
  const env = { ...process.env };
  for (const key of [
    'npm_config_prefix',
    'npm_lifecycle_event',
    'npm_lifecycle_script',
    'npm_package_json',
    'npm_package_name',
    'npm_package_version',
  ]) delete env[key];
  return env;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: false,
    shell: isWindows,
    env: cleanNpmEnv(),
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function install(dir) {
  const cwd = resolve(root, dir);
  const useCi = existsSync(resolve(cwd, 'package-lock.json'));
  console.log(`\nInstalling ${dir} dependencies with npm ${useCi ? 'ci' : 'install'}...`);
  run('npm', [useCi ? 'ci' : 'install'], cwd);
}

function typecheck(dir) {
  const cwd = resolve(root, dir);
  console.log(`\nType-checking ${dir}...`);
  run('npm', ['run', 'typecheck'], cwd);
}

install('backend');
install('mobile');

console.log('\nChecking mobile React resolution...');
run('node', ['-e', "console.log('React:', require.resolve('react/package.json')); console.log('React Native:', require.resolve('react-native/package.json'))"], resolve(root, 'mobile'));

typecheck('backend');
typecheck('mobile');

console.log('\nTekBooks setup completed successfully.');
console.log('Next: docker compose up -d');
console.log('Then: npm run dev');
