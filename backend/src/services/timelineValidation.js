/**
 * timelineValidator.js
 * Import pipeline for .timeline.json files.
 *
 * Pipeline: size check → JSON.parse (proto-guarded) → schemaVersion check
 *           → Ajv Layer 1 → app-layer checks (ID uniqueness, edge refs)
 *
 * Returns: { ok: true, doc } | { ok: false, errors: ValidationError[] }
 *
 * ValidationError shape:
 *   { path: string, message: string, code: string }
 *   code is one of:
 *     "PARSE_ERROR" | "PROTO_POLLUTION" | "SCHEMA_VERSION_NEWER"
 *     | "SCHEMA_INVALID" | "DUPLICATE_ID" | "UNKNOWN_EDGE_REF" | "SIZE_EXCEEDED"
 */

const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const schema = require("../../schema/timeline.schema.json");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_NODE_COUNT = 10000;
const CURRENT_SCHEMA_VERSION = 1;

// ─── Prototype Pollution Guard ───────────────────────────────────────────────

/**
 * Recursively walks a parsed object and rejects if any key is
 * `__proto__`, `constructor`, or `__defineGetter__`.
 * Returns { ok: true } or { ok: false, errors: [...] }.
 */
function checkPrototypePollution(obj, path = "$") {
  const errors = [];
  const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "__defineGetter__"]);

  function walk(value, currentPath) {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${currentPath}[${i}]`));
      return;
    }
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) {
        errors.push({
          path: currentPath,
          message: `Dangerous key "${key}" detected (prototype pollution)`,
          code: "PROTO_POLLUTION",
        });
        return; // stop walking this branch
      }
      walk(value[key], `${currentPath}.${key}`);
    }
  }

  walk(obj, path);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ─── Ajv Setup (compiled once, reused) ──────────────────────────────────────

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
});
addFormats(ajv);
const validate = ajv.compile(schema);

// ─── App-Layer Checks (beyond JSON Schema) ──────────────────────────────────

function checkIdUniqueness(doc) {
  const errors = [];
  const nodeIds = new Set();
  for (const node of doc.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push({
        path: `$.nodes[id="${node.id}"]`,
        message: `Duplicate node ID: "${node.id}"`,
        code: "DUPLICATE_ID",
      });
    }
    nodeIds.add(node.id);
  }

  const edgeIds = new Set();
  for (const edge of doc.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push({
        path: `$.edges[id="${edge.id}"]`,
        message: `Duplicate edge ID: "${edge.id}"`,
        code: "DUPLICATE_ID",
      });
    }
    edgeIds.add(edge.id);
  }
  return errors;
}

function checkEdgeReferences(doc) {
  const errors = [];
  const nodeIds = new Set(doc.nodes.map((n) => n.id));
  for (const edge of doc.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push({
        path: `$.edges[id="${edge.id}"].from`,
        message: `Edge "${edge.id}" references unknown node "${edge.from}"`,
        code: "UNKNOWN_EDGE_REF",
      });
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({
        path: `$.edges[id="${edge.id}"].to`,
        message: `Edge "${edge.id}" references unknown node "${edge.to}"`,
        code: "UNKNOWN_EDGE_REF",
      });
    }
  }
  return errors;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Validates a raw JSON string (or Buffer) representing a .timeline.json file.
 *
 * @param {string|Buffer} raw - File content
 * @returns {{ ok: true, doc: object } | { ok: false, errors: ValidationError[] }}
 */
function validateTimelineJson(raw) {
  // 1. Size check
  const size = Buffer.isBuffer(raw) ? raw.length : Buffer.byteLength(raw, "utf-8");
  if (size > MAX_FILE_SIZE) {
    return {
      ok: false,
      errors: [{ path: "$", message: `File exceeds 50MB limit (${(size / 1024 / 1024).toFixed(1)}MB)`, code: "SIZE_EXCEEDED" }],
    };
  }

  // 2. JSON.parse
  let parsed;
  try {
    parsed = JSON.parse(raw.toString("utf-8"));
  } catch (e) {
    return {
      ok: false,
      errors: [{ path: "$", message: `JSON parse error: ${e.message}`, code: "PARSE_ERROR" }],
    };
  }

  // 3. Prototype pollution guard
  const protoCheck = checkPrototypePollution(parsed);
  if (!protoCheck.ok) return protoCheck;

  // 4. schemaVersion check
  if (parsed.meta && typeof parsed.meta.schemaVersion === "number") {
    if (parsed.meta.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        ok: false,
        errors: [{
          path: "$.meta.schemaVersion",
          message: `File requires schema v${parsed.meta.schemaVersion}; app supports v${CURRENT_SCHEMA_VERSION}. Update the app.`,
          code: "SCHEMA_VERSION_NEWER",
        }],
      };
    }
    // If older, migrations would run here (Phase 14). For now v1 is current.
  }

  // 5. Ajv Layer 1 validation
  if (!validate(parsed)) {
    const errors = (validate.errors || []).map((e) => ({
      path: e.instancePath || "$",
      message: `${e.message} (at ${e.instancePath || "$"})`,
      code: "SCHEMA_INVALID",
    }));
    return { ok: false, errors };
  }

  // 6. App-layer: ID uniqueness
  const idErrors = checkIdUniqueness(parsed);
  if (idErrors.length > 0) return { ok: false, errors: idErrors };

  // 7. App-layer: edge references
  const refErrors = checkEdgeReferences(parsed);
  if (refErrors.length > 0) return { ok: false, errors: refErrors };

  // 8. Node count ceiling
  if (parsed.nodes.length > MAX_NODE_COUNT) {
    return {
      ok: false,
      errors: [{ path: "$.nodes", message: `Node count ${parsed.nodes.length} exceeds hard ceiling of ${MAX_NODE_COUNT}. Split into multiple timelines.`, code: "SIZE_EXCEEDED" }],
    };
  }

  return { ok: true, doc: parsed };
}

module.exports = {
  validateTimelineJson,
  checkPrototypePollution,
  checkIdUniqueness,
  checkEdgeReferences,
  CURRENT_SCHEMA_VERSION,
};
