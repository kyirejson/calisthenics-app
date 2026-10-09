const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'public/chat-pdf');
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'), path.join(destination, 'pdf.worker.min.mjs'));
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  fs.cpSync(path.join(root, 'node_modules/pdfjs-dist', directory), path.join(destination, directory), { recursive: true });
}
console.log('Local chat PDF worker ready.');
