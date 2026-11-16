import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '../../timelineSchema/timeline.schema.json');

// ─── Compiled once, reused ──────────────────────────────────────────────────

const rawSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateDoc = ajv.compile(rawSchema);
const templateSchema = { ...rawSchema.$defs.Template, $defs: rawSchema.$defs };
const validateTplSchema = ajv.compile(templateSchema);

// ─── Prototype pollution guard ──────────────────────────────────────────────

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function checkProtoPollution(obj, path = '') {
  if (obj === null || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const err = checkProtoPollution(obj[i], `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return `Forbidden key "${key}" at ${path || 'root'}`;
    }
    const err = checkProtoPollution(obj[key], path ? `${path}.${key}` : key);
    if (err) return err;
  }
  return null;
}

// ─── Layer 1: Structural validation ─────────────────────────────────────────

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Validate a parsed TimelineDoc object.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateTimelineDoc(doc) {
  const errors = [];

  // 0. Proto-pollution guard
  const protoErr = checkProtoPollution(doc);
  if (protoErr) return { valid: false, errors: [protoErr] };

  // 1. schemaVersion check
  if (doc.meta?.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion ${doc.meta.schemaVersion} exceeds supported version ${CURRENT_SCHEMA_VERSION}. Update the app.`
    );
    return { valid: false, errors };
  }

  // 2. Ajv structural validation
  if (!validateDoc(doc)) {
    for (const e of validateDoc.errors || []) {
      errors.push(`${e.instancePath || '/'}: ${e.message}`);
    }
    return { valid: false, errors };
  }

  // 3. Node ID uniqueness
  const nodeIds = new Set();
  for (const node of doc.nodes || []) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: "${node.id}"`);
    }
    nodeIds.add(node.id);
  }

  // 4. Edge ID uniqueness
  const edgeIds = new Set();
  for (const edge of doc.edges || []) {
    if (edgeIds.has(edge.id)) {
      errors.push(`Duplicate edge ID: "${edge.id}"`);
    }
    edgeIds.add(edge.id);
  }

  // 5. Edge from/to reference existing nodes
  for (const edge of doc.edges || []) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge "${edge.id}": from references unknown node "${edge.from}"`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge "${edge.id}": to references unknown node "${edge.to}"`);
    }
  }

  // 6. Node count ceiling
  if (doc.nodes?.length > 10000) {
    errors.push(`Node count ${doc.nodes.length} exceeds hard ceiling of 10,000`);
  }

  // 7. TimeStamp sanity: derived.start <= derived.end
  for (const node of doc.nodes || []) {
    if (node.time?.derived?.start != null && node.time?.derived?.end != null) {
      if (node.time.derived.start > node.time.derived.end) {
        errors.push(`Node "${node.id}": time.derived.start (${node.time.derived.start}) > end (${node.time.derived.end})`);
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

/**
 * Validate a parsed Template object.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateTemplate(tpl) {
  const errors = [];

  const protoErr = checkProtoPollution(tpl);
  if (protoErr) return { valid: false, errors: [protoErr] };

  if (tpl.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion ${tpl.schemaVersion} exceeds supported version ${CURRENT_SCHEMA_VERSION}`
    );
    return { valid: false, errors };
  }

  if (!validateTplSchema(tpl)) {
    for (const e of validateTplSchema.errors || []) {
      errors.push(`${e.instancePath || '/'}: ${e.message}`);
    }
    return { valid: false, errors };
  }

  // Same ID uniqueness + ref checks as doc
  const nodeIds = new Set();
  for (const node of tpl.nodes || []) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: "${node.id}"`);
    nodeIds.add(node.id);
  }
  for (const edge of tpl.edges || []) {
    if (!nodeIds.has(edge.from)) errors.push(`Edge "${edge.id}": from references unknown node "${edge.from}"`);
    if (!nodeIds.has(edge.to)) errors.push(`Edge "${edge.id}": to references unknown node "${edge.to}"`);
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

// ─── File import pipeline (ordered, per Section 8d) ─────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Full import pipeline for a .timeline.json Buffer or string.
 * Returns { valid: true, doc } or { valid: false, errors: string[] }.
 */
export function importTimelineFile(input) {
  // 1. Size check
  const size = typeof input === 'string' ? Buffer.byteLength(input) : input.length;
  if (size > MAX_FILE_SIZE) {
    return { valid: false, errors: ['File exceeds 50MB limit'] };
  }

  // 2. Parse
  let doc;
  try {
    doc = JSON.parse(typeof input === 'string' ? input : input.toString('utf-8'));
  } catch (e) {
    return { valid: false, errors: [`JSON parse error: ${e.message}`] };
  }

  // 3–7. Structural validation (includes proto guard, schemaVersion, Ajv,
  //      ID uniqueness, edge refs, node ceiling, time sanity)
  return validateTimelineDoc(doc);
}

export { CURRENT_SCHEMA_VERSION };
