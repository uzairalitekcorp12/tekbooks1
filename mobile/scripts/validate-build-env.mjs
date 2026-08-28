const profile = process.env.EAS_BUILD_PROFILE || '';

if (!['preview', 'production'].includes(profile)) {
  console.log(`Skipping public API validation for EAS profile "${profile || 'local'}".`);
  process.exit(0);
}

const raw = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
let apiUrl;
try {
  apiUrl = new URL(raw);
} catch {
  console.error('EXPO_PUBLIC_API_URL must be set in the selected EAS environment before building an installed app.');
  process.exit(1);
}

const privateHost = /^(?:localhost|127\.0\.0\.1|10\.0\.2\.2|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(apiUrl.hostname);
if (apiUrl.protocol !== 'https:' || privateHost || !apiUrl.pathname.replace(/\/$/, '').endsWith('/api')) {
  console.error('Installed TekBooks builds require EXPO_PUBLIC_API_URL=https://YOUR-PUBLIC-API/api. Localhost, emulator, LAN IP, and non-HTTPS values are rejected.');
  process.exit(1);
}

if (process.env.EXPO_PUBLIC_AUTO_LAN !== 'false' || process.env.EXPO_PUBLIC_PROXY_API_THROUGH_METRO !== 'false') {
  console.error('Installed builds require EXPO_PUBLIC_AUTO_LAN=false and EXPO_PUBLIC_PROXY_API_THROUGH_METRO=false.');
  process.exit(1);
}

console.log(`Installed-app API configuration passed (${apiUrl.origin}/api).`);
