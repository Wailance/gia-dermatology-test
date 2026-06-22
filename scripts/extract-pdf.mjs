import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const buffer = readFileSync(join(root, 'GIA_test.pdf'));
const data = await pdf(buffer);
writeFileSync(join(root, 'source.txt'), data.text, 'utf8');
console.log(`Extracted ${data.text.length} chars, ${data.numpages} pages`);
