import { describe, it, expect } from 'vitest';
import {
    validateTimelineDoc,
    validateTemplate,
    importTimelineFile,
    CURRENT_SCHEMA_VERSION,
} from '../src/services/timelineValidator.js';
import { loadFixture } from '../timelineSchema/fixtures/loadFixture.js';

describe('timelineValidator', () => {
  // ─── Valid documents ──────────────────────────────────────────────────────

  it('accepts minimal.json', () => {
    const doc = loadFixture('minimal');
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(true);
  });

  it('accepts empty-nodes.json', () => {
    const doc = loadFixture('empty-nodes');
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(true);
  });

  it('accepts exodus-cluster.json', () => {
    const doc = loadFixture('exodus-cluster');
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(true);
  });

  it('accepts all-kinds.json', () => {
    const doc = loadFixture('all-kinds');
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(true);
  });

  it('accepts all-optional.json', () => {
    const doc = loadFixture('all-optional');
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(true);
  });

  // ─── Rejected documents ───────────────────────────────────────────────────

  it('rejects bad-missing-ref.json (edge references unknown node)', () => {
    const doc = loadFixture('bad-missing-ref');
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown node'))).toBe(true);
  });

  it('rejects bad-duplicate-id.json (duplicate node ID)', () => {
    const doc = loadFixture('bad-duplicate-id');
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate node ID'))).toBe(true);
  });

  it('rejects bad-schema-version.json (schemaVersion too high)', () => {
    const doc = loadFixture('bad-schema-version');
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds supported version'))).toBe(true);
  });

  it('rejects bad-invalid-kind.json (invalid NodeKind)', () => {
    const doc = loadFixture('bad-invalid-kind');
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ─── Prototype pollution ──────────────────────────────────────────────────

  it('rejects document with __proto__ key', () => {
    const doc = loadFixture('minimal');
    Object.defineProperty(doc.nodes[0], '__proto__', {
        value: { hacked: true },
        enumerable: true,
        configurable: true,
    });
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Forbidden key'))).toBe(true);
  });

  it('rejects document with constructor key', () => {
    const doc = loadFixture('minimal');
    Object.defineProperty(doc.nodes[0], 'constructor', {
        value: 'evil',
        enumerable: true,
        configurable: true,
    });
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Forbidden key'))).toBe(true);
  });

  // ─── TimeStamp sanity ─────────────────────────────────────────────────────

  it('rejects node where derived.start > derived.end', () => {
    const doc = loadFixture('minimal');
    doc.nodes[0].time.derived.start = -1000;
    doc.nodes[0].time.derived.end = -2000;
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('start') && e.includes('end'))).toBe(true);
  });

  // ─── Node count ceiling ───────────────────────────────────────────────────

  it('rejects document with more than 10,000 nodes', () => {
    const doc = loadFixture('minimal');
    doc.nodes = Array.from({ length: 10001 }, (_, i) => ({
      id: `n-${i}`,
      kind: 'event',
      label: `Node ${i}`,
    }));
    const result = validateTimelineDoc(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('hard ceiling'))).toBe(true);
  });

  // ─── importTimelineFile ───────────────────────────────────────────────────

  it('parses and validates a JSON string', () => {
    const doc = loadFixture('minimal');
    const result = importTimelineFile(JSON.stringify(doc));
    expect(result.valid).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const result = importTimelineFile('{ not valid json');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('JSON parse error'))).toBe(true);
  });

  it('rejects oversized input', () => {
    const big = 'x'.repeat(51 * 1024 * 1024);
    const result = importTimelineFile(big);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('50MB'))).toBe(true);
  });

  // ─── Template validation ──────────────────────────────────────────────────

  it('accepts a valid template', () => {
    const tpl = {
      id: 'tpl-test',
      name: 'Test Template',
      schemaVersion: 1,
      nodes: [{ id: 'n1', kind: 'event', label: 'Event' }],
      edges: [],
    };
    const result = validateTemplate(tpl);
    expect(result.valid).toBe(true);
  });

  it('rejects template with edge referencing unknown node', () => {
    const tpl = {
      id: 'tpl-bad',
      name: 'Bad Template',
      schemaVersion: 1,
      nodes: [{ id: 'n1', kind: 'event', label: 'Event' }],
      edges: [{ id: 'e1', from: 'n1', to: 'n-missing', kind: 'causes', confidence: 'certain' }],
    };
    const result = validateTemplate(tpl);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown node'))).toBe(true);
  });

  // ─── CURRENT_SCHEMA_VERSION ───────────────────────────────────────────────

  it('exports CURRENT_SCHEMA_VERSION as 1', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
});
