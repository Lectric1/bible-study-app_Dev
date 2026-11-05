import { Router } from 'express';
import { serializeTimeline, updateNode, updateEdge } from '../services/timelineStorage.js';
import { prisma } from '../db/prisma.js';
export const timelinesRouter = Router();

// GET /api/timelines
timelinesRouter.get('/', async (req, res, next) => {
  try {
    const timelines = await prisma.timeline.findMany({
      select: {
        id: true,
        title: true,
        author: true,
        version: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(timelines);
  } catch (err) {
    next(err);
  }
});

// GET /api/timelines/:id
timelinesRouter.get('/:id', async (req, res, next) => {
  try {
    const doc = await serializeTimeline(req.params.id);
    res.json(doc);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: 'Timeline not found' });
    }
    next(err);
  }
});


// Allowed enum values for validation
const NODE_KINDS = ['event','span','person','place','covenant','book','political','theme','period'];
const NODE_CONFIDENCE = ['scriptural','traditional','archaeological','inferred'];
const TIME_CONFIDENCE = ['exact','approximate','disputed','undated'];
const COVENANT_STATUS = ['active','fulfilled','superseded','awaiting'];
const TRAJECTORY = ['rising','stable','declining','collapsed'];
const EDGE_KINDS = ['causes','precedes','concurrent','contains','synchronizes','responds','prophesies','fulfills','types','escalates','contrasts','covenants','father_of','teacher_of','succeeds','rival_of','allied_with','vassal_of','located_in','governs','part_of','echoes','references'];
const EDGE_CONFIDENCE = ['certain','probable','traditional','speculative'];

// Fields that lock protects (per design doc §3.3 / §3.4)
const NODE_LOCKED_FIELDS = ['time', 'kind', 'label'];
const EDGE_LOCKED_FIELDS = ['kind', 'confidence', 'claim'];

// PATCH /api/timelines/:id/nodes/:nodeId
timelinesRouter.patch('/:id/nodes/:nodeId', async (req, res, next) => {
  try {
    const { id: timelineId, nodeId } = req.params;
    const fields = req.body;

    // Fetch existing node to check lock + validate enums against current state
    const existing = await prisma.node.findUnique({
      where: { timelineId_id: { timelineId, id: nodeId } },
    });
    if (!existing) return res.status(404).json({ error: 'Node not found' });

    // Lock check
    if (existing.locked) {
      const protectedKeys = Object.keys(fields).filter((k) => NODE_LOCKED_FIELDS.includes(k));
      if (protectedKeys.length > 0) {
        return res.status(403).json({
          error: `Node is locked. Cannot modify: ${protectedKeys.join(', ')}. Unlock first.`,
        });
      }
    }

    // Enum validation (only validate fields that are being changed)
    if ('kind' in fields && !NODE_KINDS.includes(fields.kind)) {
      return res.status(400).json({ error: `Invalid kind: '${fields.kind}'` });
    }
    if ('confidence' in fields && fields.confidence !== null && !NODE_CONFIDENCE.includes(fields.confidence)) {
      return res.status(400).json({ error: `Invalid confidence: '${fields.confidence}'` });
    }
    if ('status' in fields && fields.status !== null && !COVENANT_STATUS.includes(fields.status)) {
      return res.status(400).json({ error: `Invalid status: '${fields.status}'` });
    }
    if ('trajectory' in fields && fields.trajectory !== null && !TRAJECTORY.includes(fields.trajectory)) {
      return res.status(400).json({ error: `Invalid trajectory: '${fields.trajectory}'` });
    }
    if (fields.time?.confidence && !TIME_CONFIDENCE.includes(fields.time.confidence)) {
      return res.status(400).json({ error: `Invalid time.confidence: '${fields.time.confidence}'` });
    }

    const updated = await updateNode(timelineId, nodeId, fields);
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Node not found' });
    next(err);
  }
});

// PATCH /api/timelines/:id/edges/:edgeId
timelinesRouter.patch('/:id/edges/:edgeId', async (req, res, next) => {
  try {
    const { id: timelineId, edgeId } = req.params;
    const fields = req.body;

    const existing = await prisma.edge.findUnique({
      where: { timelineId_id: { timelineId, id: edgeId } },
    });
    if (!existing) return res.status(404).json({ error: 'Edge not found' });

    // Lock check
    if (existing.locked) {
      const protectedKeys = Object.keys(fields).filter((k) => EDGE_LOCKED_FIELDS.includes(k));
      if (protectedKeys.length > 0) {
        return res.status(403).json({
          error: `Edge is locked. Cannot modify: ${protectedKeys.join(', ')}. Unlock first.`,
        });
      }
    }

    // Enum validation
    if ('kind' in fields && !EDGE_KINDS.includes(fields.kind)) {
      return res.status(400).json({ error: `Invalid kind: '${fields.kind}'` });
    }
    if ('confidence' in fields && !EDGE_CONFIDENCE.includes(fields.confidence)) {
      return res.status(400).json({ error: `Invalid confidence: '${fields.confidence}'` });
    }

    const updated = await updateEdge(timelineId, edgeId, fields);
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Edge not found' });
    next(err);
  }
});
