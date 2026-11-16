import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { readTimeline, listTimelinesForUser } from '../services/timelineStorage.js';

export const timelinesRouter = Router();

timelinesRouter.use((req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    next();
});
// GET /api/timelines — list user's timelines (owned + shared)
timelinesRouter.get('/', async (req, res, next) => {
  try {
    const timelines = await listTimelinesForUser(req.user.id);
    res.json(timelines);
  } catch (err) {
    next(err);
  }
});

// GET /api/timelines/:id — full TimelineDoc (owner or shared)
timelinesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Access check: owner OR has a share
    const [timeline, share] = await Promise.all([
      prisma.timeline.findUnique({ where: { id }, select: { userId: true } }),
      prisma.timelineShare.findUnique({
        where: { timelineId_userId: { timelineId: id, userId: req.user.id } },
      }),
    ]);

    if (!timeline) return res.status(404).json({ error: 'Timeline not found' });
    if (timeline.userId !== req.user.id && !share) {
      return res.status(403).json({ error: 'No access to this timeline' });
    }

    const doc = await readTimeline(id);
    if (!doc) return res.status(404).json({ error: 'Timeline not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});
