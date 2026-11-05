import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js'; // adjust to your app entry
import { prisma } from '../db/prisma.js';

// Helper: create a minimal timeline with one node + one edge for testing
async function seedTestTimeline() {
  const timelineId = 'test-tl-' + Date.now();
  await prisma.timeline.create({
    data: {
      id: timelineId,
      title: 'Test',
      author: 'test',
      schemaVersion: 1,
      version: 1,
      defaultChronology: 'thiele',
      yearStart: -2000,
      yearEnd: 0,
    },
  });
  await prisma.node.createMany({
    data: [
      { id: 'n1', timelineId, kind: 'event', label: 'Event One', timeJson: { derived: { start: -1446 }, confidence: 'approximate' } },
      { id: 'n2', timelineId, kind: 'person', label: 'Person Two', locked: true },
    ],
  });
  await prisma.edge.createMany({
    data: [
      { id: 'e1', timelineId, fromId: 'n1', toId: 'n2', kind: 'causes', confidence: 'certain' },
    ],
  });
  return timelineId;
}

describe('PATCH /timelines/:id/nodes/:nodeId', () => {
  let timelineId;

  beforeAll(async () => {
    timelineId = await seedTestTimeline();
  });

  afterAll(async () => {
    await prisma.edge.deleteMany({ where: { timelineId } });
    await prisma.node.deleteMany({ where: { timelineId } });
    await prisma.timeline.delete({ where: { id: timelineId } });
  });

  it('updates label', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/nodes/n1`)
      .send({ label: 'Event One (updated)' });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Event One (updated)');
  });

  it('updates time.derived.start', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/nodes/n1`)
      .send({ time: { derived: { start: -1445 }, confidence: 'approximate' } });
    expect(res.status).toBe(200);
    expect(res.body.time.derived.start).toBe(-1445);
  });

  it('rejects invalid kind enum', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/nodes/n1`)
      .send({ kind: 'invalid_kind' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid kind');
  });

  it('rejects edit to locked node (protected field)', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/nodes/n2`)
      .send({ label: 'Hacked' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('locked');
  });

  it('allows edit to locked node (non-protected field)', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/nodes/n2`)
      .send({ note: 'This note is editable even when locked' });
    expect(res.status).toBe(200);
    expect(res.body.note).toBe('This note is editable even when locked');
  });

  it('returns 404 for non-existent node', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/nodes/nonexistent`)
      .send({ label: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /timelines/:id/edges/:edgeId', () => {
  let timelineId;

  beforeAll(async () => {
    timelineId = await seedTestTimeline();
  });

  afterAll(async () => {
    await prisma.edge.deleteMany({ where: { timelineId } });
    await prisma.node.deleteMany({ where: { timelineId } });
    await prisma.timeline.delete({ where: { id: timelineId } });
  });

  it('updates confidence', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/edges/e1`)
      .send({ confidence: 'traditional' });
    expect(res.status).toBe(200);
    expect(res.body.confidence).toBe('traditional');
  });

  it('rejects invalid confidence enum', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/edges/e1`)
      .send({ confidence: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('sets color', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/edges/e1`)
      .send({ color: '#ff0000' });
    expect(res.status).toBe(200);
    expect(res.body.color).toBe('#ff0000');
  });

  it('returns 404 for non-existent edge', async () => {
    const res = await request(app)
      .patch(`/timelines/${timelineId}/edges/nonexistent`)
      .send({ note: 'x' });
    expect(res.status).toBe(404);
  });
});
