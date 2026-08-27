import fs from 'node:fs';
import path from 'node:path';

const paths = [
  path.join('mobile', 'node_modules'),
  path.join('mobile', '.expo'),
];
for (const p of paths) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`Removed ${p}`);
  }
}
console.log('\nMobile clean complete. Run: npm --prefix mobile install');
