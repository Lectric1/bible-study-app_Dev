import { Router } from 'express';
import { serializeTimeline } from '../services/timelineStorage.js';
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
