import { readdirSync, statSync, readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join, extname } from 'node:path';

const DIST = 'dist';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(DIST).sort();
const kb = (n) => (n / 1024).toFixed(1).padStart(8) + ' KB';

let raw = 0;
let gz = 0;
let br = 0;

console.log('\n  file'.padEnd(52) + 'raw'.padStart(11) + 'gzip'.padStart(11) + 'brotli'.padStart(11));
console.log('  ' + '─'.repeat(81));

for (const f of files) {
  const buf = readFileSync(f);
  const compressible = ['.js', '.css', '.html', '.svg', '.json'].includes(extname(f));
  const g = compressible ? gzipSync(buf, { level: 9 }).length : buf.length;
  const b = compressible ? brotliCompressSync(buf).length : buf.length;
  raw += buf.length;
  gz += g;
  br += b;
  console.log('  ' + f.padEnd(50) + kb(buf.length) + kb(g) + kb(b));
}

console.log('  ' + '─'.repeat(81));
console.log('  ' + 'total'.padEnd(50) + kb(raw) + kb(gz) + kb(br));
console.log('  ' + 'over the wire'.padEnd(50) + ' '.repeat(11) + kb(gz) + kb(br) + '\n');
