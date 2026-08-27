import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function readDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

export function isPrivateIpv4(value = '') {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

function scoreInterface(name, address) {
  const n = name.toLowerCase();
  let score = 0;
  if (/wi-?fi|wireless|wlan/.test(n)) score += 100;
  if (/ethernet/.test(n)) score += 70;
  if (/vmware|virtualbox|vbox|vethernet|wsl|hyper-v|docker|loopback|tailscale|zerotier/.test(n)) score -= 200;
  if (address.startsWith('192.168.')) score += 20;
  if (address.startsWith('10.')) score += 10;
  return score;
}

export function listLanCandidates() {
  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const item of entries || []) {
      if (item.family !== 'IPv4' || item.internal || !isPrivateIpv4(item.address)) continue;
      candidates.push({ name, address: item.address, score: scoreInterface(name, item.address) });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

export function resolveLanHost(root, env = process.env) {
  const mobileEnv = readDotEnv(path.join(root, 'mobile', '.env'));
  const apiUrl = env.EXPO_PUBLIC_API_URL || mobileEnv.EXPO_PUBLIC_API_URL || '';
  let apiHost = '';
  try {
    const url = new URL(apiUrl);
    apiHost = url.hostname;
  } catch {}

  const candidates = listLanCandidates();
  if (isPrivateIpv4(apiHost)) {
    const matching = candidates.find(item => item.address === apiHost);
    return {
      host: apiHost,
      source: matching ? 'mobile/.env API URL + active adapter' : 'mobile/.env API URL',
      apiUrl,
      candidates,
      warning: matching ? '' : `The API host ${apiHost} is not present on an active local adapter. If you changed Wi-Fi, update mobile/.env.`,
    };
  }

  const best = candidates[0];
  return {
    host: best?.address || '',
    source: best ? `network adapter ${best.name}` : 'unresolved',
    apiUrl,
    candidates,
    warning: best ? '' : 'No private IPv4 LAN adapter could be detected.',
  };
}
