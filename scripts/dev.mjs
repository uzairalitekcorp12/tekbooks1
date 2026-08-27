import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { resolveLanHost } from './network-utils.mjs';

const root = process.cwd();
const isWindows = process.platform === 'win32';
const children = [];
const tunnel = process.argv.includes('--tunnel');
const lan = resolveLanHost(root);

function cleanNpmEnv() {
  const env = { ...process.env };
  for (const key of [
    'npm_config_prefix',
    'npm_lifecycle_event',
    'npm_lifecycle_script',
    // Stale values from previous Expo sessions can force localhost even with --lan.
    'EXPO_PACKAGER_PROXY_URL',
    'REACT_NATIVE_PACKAGER_HOSTNAME',
  ]) delete env[key];
  return env;
}

function run(cwd, args, extraEnv = {}) {
  const child = spawn('npm', args, {
    cwd: resolve(root, cwd),
    stdio: 'inherit',
    windowsHide: false,
    shell: isWindows,
    env: { ...cleanNpmEnv(), ...extraEnv },
  });
  children.push(child);
  child.on('error', error => console.error(`Failed to start ${cwd}:`, error));
  child.on('exit', code => {
    if (code && code !== 0) console.error(`${cwd} process exited with code ${code}.`);
  });
  return child;
}

console.log('Starting TekBooks API and Expo SDK 54 app...');
console.log('API:   http://localhost:4000');

if (tunnel) {
  console.log('Expo:  TUNNEL mode (use this when LAN is blocked by Windows Firewall/router)\n');
} else if (lan.host) {
  console.log(`Expo:  LAN mode via ${lan.host} (${lan.source})`);
  console.log(`Phone test: http://${lan.host}:8081/_expo/loading`);
  console.log(`API test:   http://${lan.host}:4000/health`);
  if (lan.warning) console.warn(`Warning: ${lan.warning}`);
  console.log('');
} else {
  console.error('Could not resolve a LAN IPv4 address. Use `npm run dev:tunnel` or fix mobile/.env.\n');
}

run('backend', ['start']);

if (tunnel) {
  run('mobile', ['start', '--', '--tunnel', '--go']);
} else {
  const expoEnv = lan.host
    ? {
        // EXPO_PACKAGER_PROXY_URL is the current Expo CLI escape hatch for the URL advertised to devices.
        EXPO_PACKAGER_PROXY_URL: `http://${lan.host}:8081`,
        // Keep this too for SDK 54 compatibility, although newer CLI paths may ignore it.
        REACT_NATIVE_PACKAGER_HOSTNAME: lan.host,
      }
    : {};
  run('mobile', ['start', '--', '--lan', '--go'], expoEnv);
}

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGINT');
  }
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
