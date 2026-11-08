// CLI validator for content/ documents using the shared contracts.
//
// Usage: node scripts/validate-content.mjs
//   - prints "OK <path>" for each document and exits 0 when all are valid
//   - prints the list of contract errors and exits 1 otherwise
//
// Validated documents:
//   - content/cases.json   → validateCasesDoc  (content/cases-contract.mjs)
//   - content/locales.json → validateLocalesDoc (content/locales-contract.mjs)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCasesDoc } from '../content/cases-contract.mjs';
import { validateLocalesDoc } from '../content/locales-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DOCUMENTS = [
  { file: 'cases.json', validate: validateCasesDoc },
  { file: 'locales.json', validate: validateLocalesDoc },
];

let failed = false;

for (const { file, validate } of DOCUMENTS) {
  const filePath = path.join(__dirname, '..', 'content', file);

  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${filePath}: ${err.message}`);
    failed = true;
    continue;
  }

  const result = validate(doc);
  if (result.ok) {
    console.log(`OK ${filePath}`);
    continue;
  }

  failed = true;
  console.error(`Invalid content document (${filePath}):`);
  for (const error of result.errors) console.error(`  - ${error}`);
}

process.exit(failed ? 1 : 0);
