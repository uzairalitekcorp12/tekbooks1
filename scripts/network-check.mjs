import { resolveLanHost } from './network-utils.mjs';

const root = process.cwd();
const lan = resolveLanHost(root);
console.log('TekBooks local network check');
console.log('----------------------------');
console.log(`Resolved LAN host: ${lan.host || 'NOT FOUND'}`);
console.log(`Source: ${lan.source}`);
if (lan.apiUrl) console.log(`mobile/.env API: ${lan.apiUrl}`);
if (lan.warning) console.log(`Warning: ${lan.warning}`);
console.log('');
console.log('Detected private IPv4 adapters:');
for (const item of lan.candidates) console.log(`- ${item.name}: ${item.address}${item.address === lan.host ? '  <-- selected' : ''}`);
if (lan.host) {
  console.log('');
  console.log('While `npm run dev` is running, open these on the PHONE:');
  console.log(`- Expo: http://${lan.host}:8081/_expo/loading`);
  console.log(`- API:  http://${lan.host}:4000/health`);
}
