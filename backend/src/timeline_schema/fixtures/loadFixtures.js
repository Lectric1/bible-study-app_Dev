// In a helper: backend/src/timelineSchema/fixtures/loadFixture.js
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadFixture(name) {
  return JSON.parse(readFileSync(resolve(__dirname, `${name}.json`), "utf-8"));
}   
