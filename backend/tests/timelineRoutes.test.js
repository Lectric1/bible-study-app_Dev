import { describe, it, expect, beforeEach } from 'vitest';
import { getApp, createAuthAgent, bootstrapTestAdmin, loginAs, createTestUser } from './helpers.js';
import { prisma } from '../src/db/prisma.js';

describe('Timeline Routes', () => {
    let app, agent, admin;

    beforeEach(async () => {
        app = await getApp();
        agent = createAuthAgent(app);
        admin = await bootstrapTestAdmin(agent);
    });

    it('returns 401 without auth', async () => {
        const freshAgent = createAuthAgent(app);
        const res = await freshAgent.get('/api/timelines');
        expect(res.status).toBe(401);
    });

    it('lists timelines for owner', async () => {
        await prisma.timeline.create({
            data: { userId: admin.id, title: 'Test TL', yearStart: -2000, yearEnd: 0 },
        });

        const res = await agent.get('/api/timelines');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Test TL');
        expect(res.body[0].shared).toBe(false);
    });

    it('returns full doc for owner', async () => {
        const tl = await prisma.timeline.create({
            data: { userId: admin.id, title: 'Full Doc', yearStart: -2000, yearEnd: 0 },
        });
        await prisma.timelineNode.create({
            data: {
                timelineId: tl.id,
                id: 'evt-1',
                kind: 'event',
                label: 'Exodus',
                time: { derived: { start: -1446 }, confidence: 'approximate' },
            },
        });

        const res = await agent.get(`/api/timelines/${tl.id}`);
        expect(res.status).toBe(200);
        expect(res.body.meta.title).toBe('Full Doc');
        expect(res.body.nodes).toHaveLength(1);
        expect(res.body.nodes[0].label).toBe('Exodus');
    });

    it('returns 404 for non-existent timeline', async () => {
        const res = await agent.get('/api/timelines/nonexistent-id');
        expect(res.status).toBe(404);
    });

    it('returns 403 for non-owner without share', async () => {
        const other = await createTestUser(agent, { username: 'other1' });
        const otherAgent = createAuthAgent(app);
        await loginAs(otherAgent, 'other1', 'userpass123');

        const tl = await prisma.timeline.create({
            data: { userId: admin.id, title: 'Private', yearStart: -2000, yearEnd: 0 },
        });

        const res = await otherAgent.get(`/api/timelines/${tl.id}`);
        expect(res.status).toBe(403);
    });

    it('returns 200 for shared viewer', async () => {
        const viewer = await createTestUser(agent, { username: 'viewer1' });
        const viewerAgent = createAuthAgent(app);
        await loginAs(viewerAgent, 'viewer1', 'userpass123');

        const tl = await prisma.timeline.create({
            data: { userId: admin.id, title: 'Shared TL', yearStart: -2000, yearEnd: 0 },
        });
        await prisma.timelineShare.create({
            data: { timelineId: tl.id, userId: viewer.id, role: 'viewer' },
        });

        const res = await viewerAgent.get(`/api/timelines/${tl.id}`);
        expect(res.status).toBe(200);
        expect(res.body.meta.title).toBe('Shared TL');
    });
});
