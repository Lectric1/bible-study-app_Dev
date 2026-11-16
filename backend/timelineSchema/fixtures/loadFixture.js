import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load a fixture by name (without .json extension).
 * Returns the parsed object.
 */
export function loadFixture(name) {
  const path = join(__dirname, `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}
