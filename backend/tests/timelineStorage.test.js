
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import {
    createTimeline,
    saveTimeline,
    readTimeline,
    deleteTimeline,
    listTimelinesForUser,
    shareTimeline,
    unshareTimeline,
    getPreferences,
    setPreference,
} from '../src/services/timelineStorage.js';
import { loadFixture } from '../timelineSchema/fixtures/loadFixture.js';

describe('timelineStorage', () => {
    let testUserId;
    let timelineId;

    beforeEach(async () => {
        const user = await prisma.user.create({
            data: {
                username: `tl_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                              passwordHash: 'x',
            },
        });
        testUserId = user.id;
    });

    // Remove the afterAll entirely — setup.js handles cleanup

    it('creates a new timeline', async () => {
        const tl = await createTimeline(testUserId, {
            title: 'Test Timeline',
            yearStart: -1500,
            yearEnd: -900,
        });
        expect(tl.id).toBeTruthy();
        expect(tl.title).toBe('Test Timeline');
        expect(tl.userId).toBe(testUserId);
        timelineId = tl.id;
    });

    it('saves and reads back a full document (round-trip)', async () => {
        const tl = await createTimeline(testUserId, {
            title: 'RT Test',
            yearStart: -1500,
            yearEnd: -930,
        });
        timelineId = tl.id;

        const doc = loadFixture('exodus-cluster');
        await saveTimeline(timelineId, doc, { bumpVersion: true });

        const loaded = await readTimeline(timelineId);
        expect(loaded).not.toBeNull();
        expect(loaded.meta.title).toBe(doc.meta.title);
        expect(loaded.nodes.length).toBe(doc.nodes.length);
        expect(loaded.edges.length).toBe(doc.edges.length);
        expect(loaded.display.tracks.length).toBe(doc.display.tracks.length);
    });

    it('does not bump version on autosave', async () => {
        const tl = await createTimeline(testUserId, { title: 'Auto', yearStart: -100, yearEnd: 0 });
        await saveTimeline(tl.id, loadFixture('minimal'), { bumpVersion: true });
        await saveTimeline(tl.id, loadFixture('minimal'), { bumpVersion: false });
        const loaded = await readTimeline(tl.id);
        expect(loaded.meta.version).toBe(2); // only bumped once
    });

    it('saves and reads back minimal.json (round-trip)', async () => {
        const tl = await createTimeline(testUserId, { title: 'Min', yearStart: -1500, yearEnd: -1000 });
        await saveTimeline(tl.id, loadFixture('minimal'), { bumpVersion: true });
        const loaded = await readTimeline(tl.id);
        expect(loaded.nodes.length).toBe(1);
        expect(loaded.nodes[0].id).toBe('evt-test');
        expect(loaded.edges.length).toBe(0);
    });

    it('saves and reads back empty-nodes.json (round-trip)', async () => {
        const tl = await createTimeline(testUserId, { title: 'Empty', yearStart: -2000, yearEnd: 0 });
        await saveTimeline(tl.id, loadFixture('empty-nodes'), { bumpVersion: true });
        const loaded = await readTimeline(tl.id);
        expect(loaded.nodes.length).toBe(0);
        expect(loaded.edges.length).toBe(0);
    });

    it('saves and reads back all-optional.json (round-trip)', async () => {
        const tl = await createTimeline(testUserId, { title: 'AllOpt', yearStart: -2000, yearEnd: 100 });
        await saveTimeline(tl.id, loadFixture('all-optional'), { bumpVersion: true });
        const loaded = await readTimeline(tl.id);
        const n = loaded.nodes[0];
        expect(n.subtype).toBe('patriarch');
        expect(n.locked).toBe(true);
        expect(n.image).toBe('media/test.jpg');
        expect(n.coords).toEqual([31.5, 35.0]);
        expect(loaded.display.blackAndWhite).toBe(true);
        expect(loaded.display.tracks.length).toBe(1);
    });

    it('lists timelines for a user', async () => {
        await createTimeline(testUserId, { title: 'Listed', yearStart: -100, yearEnd: 0 });
        const list = await listTimelinesForUser(testUserId);
        expect(list.length).toBeGreaterThanOrEqual(1);
        expect(list.some((t) => t.title === 'Listed')).toBe(true);
    });

    it('shares a timeline with another user', async () => {
        const tl = await createTimeline(testUserId, { title: 'Shared', yearStart: -100, yearEnd: 0 });
        const otherUser = await prisma.user.create({
            data: { username: `tl_sharee_${Date.now()}`, passwordHash: 'x' },
        });

        await shareTimeline(tl.id, otherUser.id, 'editor');
        const list = await listTimelinesForUser(otherUser.id);
        expect(list.some((t) => t.id === tl.id && t.shared === true && t.role === 'editor')).toBe(true);
    });

    it('unshares a timeline', async () => {
        const tl = await createTimeline(testUserId, { title: 'Unshared', yearStart: -100, yearEnd: 0 });
        const otherUser = await prisma.user.create({
            data: { username: `tl_unshare_${Date.now()}`, passwordHash: 'x' },
        });

        await shareTimeline(tl.id, otherUser.id, 'viewer');
        await unshareTimeline(tl.id, otherUser.id);

        const list = await listTimelinesForUser(otherUser.id);
        expect(list.some((t) => t.id === tl.id)).toBe(false);
    });

    it('sets and gets a preference', async () => {
        await setPreference(testUserId, 'defaultView', 'graph');
        const prefs = await getPreferences(testUserId);
        expect(prefs.defaultView).toBe('graph');
    });

    it('overwrites an existing preference', async () => {
        await setPreference(testUserId, 'defaultView', 'timeline');
        await setPreference(testUserId, 'defaultView', 'graph');
        const prefs = await getPreferences(testUserId);
        expect(prefs.defaultView).toBe('graph');
    });

    it('deletes a timeline and cascades to children', async () => {
        const tl = await createTimeline(testUserId, { title: 'To Delete', yearStart: -100, yearEnd: 100 });
        await saveTimeline(tl.id, loadFixture('exodus-cluster'));

        await deleteTimeline(tl.id);
        const loaded = await readTimeline(tl.id);
        expect(loaded).toBeNull();
    });
});
