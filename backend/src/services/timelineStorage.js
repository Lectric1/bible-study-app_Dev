import { prisma } from '../db/prisma.js';

// ─── Read ───────────────────────────────────────────────────────────────────

/**
 * Read a full TimelineDoc from SQL.
 * Returns the assembled doc shape (matching the JSON schema) or null.
 */
export async function readTimeline(timelineId) {
  const timeline = await prisma.timeline.findUnique({
    where: { id: timelineId },
    include: {
      nodes: true,
      edges: true,
      tracks: true,
    },
  });

  if (!timeline) return null;

  return assembleDoc(timeline);
}

/**
 * List all timelines for a user (owned + shared).
 */
export async function listTimelinesForUser(userId) {
  const [owned, shared] = await Promise.all([
    prisma.timeline.findMany({
      where: { userId },
      select: { id: true, title: true, updatedAt: true, version: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.timelineShare.findMany({
      where: { userId },
      include: {
        timeline: {
          select: { id: true, title: true, updatedAt: true, version: true, userId: true },
        },
      },
    }),
  ]);

  return [
    ...owned.map((t) => ({ ...t, shared: false })),
    ...shared.map((s) => ({ ...s.timeline, shared: true, role: s.role })),
  ];
}

// ─── Create ─────────────────────────────────────────────────────────────────

/**
 * Create a new empty timeline.
 */
export async function createTimeline(userId, { title, author, defaultChronology, yearStart, yearEnd }) {
  return prisma.timeline.create({
    data: {
      userId,
      title,
      author: author || null,
      defaultChronology: defaultChronology || 'thiele',
      yearStart,
      yearEnd,
    },
  });
}

// ─── Save (full document upsert) ────────────────────────────────────────────

/**
 * Save a full TimelineDoc to SQL.
 * Uses a transaction: delete children, update meta, insert all rows.
 * Bumps version only if `bumpVersion` is true (manual save).
 */
export async function saveTimeline(timelineId, doc, { bumpVersion = false } = {}) {
  return prisma.$transaction(async (tx) => {
    // Delete existing children
    await tx.timelineNode.deleteMany({ where: { timelineId } });
    await tx.timelineEdge.deleteMany({ where: { timelineId } });
    await tx.timelineDisplayTrack.deleteMany({ where: { timelineId } });

    // Update meta
    const meta = doc.meta || {};
    const display = doc.display || {};

    const updateData = {
        title: meta.title,
        author: meta.author || null,
        schemaVersion: meta.schemaVersion,
        defaultChronology: meta.defaultChronology || 'thiele',
            yearStart: meta.yearRange?.[0] ?? 0,
            yearEnd: meta.yearRange?.[1] ?? 0,
            blackAndWhite: display.blackAndWhite || false,
    };

    if (bumpVersion) {
        updateData.version = { increment: 1 };
    }

    await tx.timeline.update({
        where: { id: timelineId },
        data: updateData,
    });

    // Insert nodes
    const nodeData = (doc.nodes || []).map((n) => ({
      timelineId,
      id: n.id,
      kind: n.kind,
      label: n.label,
      subtype: n.subtype || null,
      time: n.time || null,
      displayOrder: n.displayOrder ?? null,
      roles: n.roles || null,
      group: n.group || null,
      tags: n.tags || null,
      terms: n.terms || null,
      status: n.status || null,
      author: n.author || null,
      genre: n.genre || null,
      eventsDescribed: n.eventsDescribed || null,
      trajectory: n.trajectory || null,
      modernName: n.modernName || null,
      coords: n.coords || null,
      siteCandidates: n.siteCandidates || null,
      image: n.image || null,
      ref: n.ref || null,
      source: n.source || null,
      confidence: n.confidence || null,
      locked: n.locked || false,
      note: n.note || null,
    }));

    if (nodeData.length > 0) {
      await tx.timelineNode.createMany({ data: nodeData });
    }

    // Insert edges
    const edgeData = (doc.edges || []).map((e) => ({
      timelineId,
      id: e.id,
      fromId: e.from,
      toId: e.to,
      kind: e.kind,
      subtype: e.subtype || null,
      confidence: e.confidence,
      source: e.source || null,
      note: e.note || null,
      claim: e.claim || null,
      color: e.color || null,
      locked: e.locked || false,
    }));

    if (edgeData.length > 0) {
      await tx.timelineEdge.createMany({ data: edgeData });
    }

    // Insert display tracks
    const trackData = (display.tracks || []).map((t) => ({
      timelineId,
      id: t.id,
      label: t.label,
      color: t.color,
      filter: t.filter,
    }));

    if (trackData.length > 0) {
      await tx.timelineDisplayTrack.createMany({ data: trackData });
    }
  });
}

// ─── Delete ─────────────────────────────────────────────────────────────────

/**
 * Delete a timeline and all its children (cascade via FK).
 */
export async function deleteTimeline(timelineId) {
  return prisma.timeline.delete({ where: { id: timelineId } });
}

// ─── Sharing ────────────────────────────────────────────────────────────────

export async function shareTimeline(timelineId, userId, role = 'viewer') {
  return prisma.timelineShare.upsert({
    where: { timelineId_userId: { timelineId, userId } },
    update: { role },
    create: { timelineId, userId, role },
  });
}

export async function unshareTimeline(timelineId, userId) {
  return prisma.timelineShare.delete({
    where: { timelineId_userId: { timelineId, userId } },
  });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listTemplatesForUser(userId) {
  return prisma.timelineTemplate.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function saveTemplate(userId, tpl) {
  return prisma.timelineTemplate.upsert({
    where: { id: tpl.id },
    update: {
      name: tpl.name,
      description: tpl.description || null,
      schemaVersion: tpl.schemaVersion,
      nodes: tpl.nodes,
      edges: tpl.edges,
      display: tpl.display || null,
      tags: tpl.tags || [],
    },
    create: {
      id: tpl.id,
      userId,
      name: tpl.name,
      description: tpl.description || null,
      schemaVersion: tpl.schemaVersion,
      nodes: tpl.nodes,
      edges: tpl.edges,
      display: tpl.display || null,
      tags: tpl.tags || [],
    },
  });
}

export async function deleteTemplate(templateId) {
  return prisma.timelineTemplate.delete({ where: { id: templateId } });
}

// ─── User Preferences ───────────────────────────────────────────────────────

export async function getPreferences(userId) {
  const rows = await prisma.timelineUserPreference.findMany({ where: { userId } });
  const prefs = {};
  for (const row of rows) {
    prefs[row.key] = row.valueJson;
  }
  return prefs;
}

export async function setPreference(userId, key, value) {
  return prisma.timelineUserPreference.upsert({
    where: { userId_key: { userId, key } },
    update: { valueJson: value },
    create: { userId, key, valueJson: value },
  });
}

// ─── Assembly helper ────────────────────────────────────────────────────────

function assembleDoc(timeline) {
  return {
    meta: {
      title: timeline.title,
      author: timeline.author || undefined,
      schemaVersion: timeline.schemaVersion,
      version: timeline.version,
      defaultChronology: timeline.defaultChronology,
      yearRange: [timeline.yearStart, timeline.yearEnd],
    },
    nodes: timeline.nodes.map((n) => {
      const node = { id: n.id, kind: n.kind, label: n.label };
      if (n.subtype) node.subtype = n.subtype;
      if (n.time) node.time = n.time;
      if (n.displayOrder != null) node.displayOrder = n.displayOrder;
      if (n.roles) node.roles = n.roles;
      if (n.group) node.group = n.group;
      if (n.tags) node.tags = n.tags;
      if (n.terms) node.terms = n.terms;
      if (n.status) node.status = n.status;
      if (n.author) node.author = n.author;
      if (n.genre) node.genre = n.genre;
      if (n.eventsDescribed) node.eventsDescribed = n.eventsDescribed;
      if (n.trajectory) node.trajectory = n.trajectory;
      if (n.modernName) node.modernName = n.modernName;
      if (n.coords) node.coords = n.coords;
      if (n.siteCandidates) node.siteCandidates = n.siteCandidates;
      if (n.image) node.image = n.image;
      if (n.ref) node.ref = n.ref;
      if (n.source) node.source = n.source;
      if (n.confidence) node.confidence = n.confidence;
      if (n.locked) node.locked = true;
      if (n.note) node.note = n.note;
      return node;
    }),
    edges: timeline.edges.map((e) => {
      const edge = { id: e.id, from: e.fromId, to: e.toId, kind: e.kind, confidence: e.confidence };
      if (e.subtype) edge.subtype = e.subtype;
      if (e.source) edge.source = e.source;
      if (e.note) edge.note = e.note;
      if (e.claim) edge.claim = e.claim;
      if (e.color) edge.color = e.color;
      if (e.locked) edge.locked = true;
      return edge;
    }),
    display: {
      ...(timeline.tracks.length > 0 || timeline.blackAndWhite
        ? {}
        : {}),
      ...(timeline.blackAndWhite ? { blackAndWhite: true } : {}),
      ...(timeline.tracks.length > 0
        ? {
            tracks: timeline.tracks.map((t) => ({
              id: t.id,
              label: t.label,
              color: t.color,
              filter: t.filter,
            })),
          }
        : {}),
    },
  };
}
