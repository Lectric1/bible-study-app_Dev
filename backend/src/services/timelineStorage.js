/**
 * timelineStorage.js
 * SQL ↔ JSON serialization for the timeline module.
 *
 * serialize:  SQL rows → TimelineDoc object (for .timeline.json export)
 * deserialize: TimelineDoc object → SQL upsert (for import)
 */

import { prisma } from "../db/prisma.js";

// ─── Serialize: SQL → TimelineDoc ────────────────────────────────────────────

/**
 * Reads a timeline and all its children from Postgres,
 * assembles the TimelineDoc shape for export.
 *
 * @param {string} timelineId
 * @returns {object} TimelineDoc (matches the JSON schema)
 * @throws {Error} if timeline not found
 */
export async function serializeTimeline(timelineId) {
  const timeline = await prisma.timeline.findUnique({
    where: { id: timelineId },
  });
  if (!timeline) throw new Error(`Timeline not found: ${timelineId}`);

  const [nodes, edges, tracks] = await Promise.all([
    prisma.node.findMany({ where: { timelineId } }),
    prisma.edge.findMany({ where: { timelineId } }),
    prisma.displayTrack.findMany({ where: { timelineId } }),
  ]);

  return {
    meta: {
      title: timeline.title,
      author: timeline.author,
      schemaVersion: timeline.schemaVersion,
      version: timeline.version,
      defaultChronology: timeline.defaultChronology,
      yearRange: [timeline.yearStart, timeline.yearEnd],
    },
    nodes: nodes.map(mapNodeFromRow),
    edges: edges.map(mapEdgeFromRow),
    display: {
      blackAndWhite: timeline.blackAndWhite,
      tracks: tracks.map((t) => ({
        id: t.id,
        label: t.label,
        color: t.color,
        filter: t.filter,
      })),
    },
  };
}

function mapNodeFromRow(row) {
  const node = {
    id: row.id,
    kind: row.kind,
    label: row.label,
  };
  // Optional fields — omit if null (keeps JSON clean)
  if (row.subtype !== null) node.subtype = row.subtype;
  if (row.timeJson !== null) node.time = row.timeJson;
  if (row.displayOrder !== null) node.displayOrder = row.displayOrder;
  if (row.rolesJson !== null) node.roles = row.rolesJson;
  if (row.group !== null) node.group = row.group;
  if (row.tagsJson !== null) node.tags = row.tagsJson;
  if (row.termsJson !== null) node.terms = row.termsJson;
  if (row.status !== null) node.status = row.status;
  if (row.authorJson !== null) node.author = row.authorJson;
  if (row.genre !== null) node.genre = row.genre;
  if (row.eventsDescribed !== null) node.eventsDescribed = row.eventsDescribed;
  if (row.trajectory !== null) node.trajectory = row.trajectory;
  if (row.modernName !== null) node.modernName = row.modernName;
  if (row.coordsJson !== null) node.coords = row.coordsJson;
  if (row.siteCandidatesJson !== null) node.siteCandidates = row.siteCandidatesJson;
  if (row.image !== null) node.image = row.image;
  if (row.ref !== null) node.ref = row.ref;
  if (row.sourceJson !== null) node.source = row.sourceJson;
  if (row.confidence !== null) node.confidence = row.confidence;
  if (row.locked) node.locked = true;
  if (row.note !== null) node.note = row.note;
  return node;
}

function mapEdgeFromRow(row) {
  const edge = {
    id: row.id,
    from: row.fromId,
    to: row.toId,
    kind: row.kind,
    confidence: row.confidence,
  };
  if (row.subtype !== null) edge.subtype = row.subtype;
  if (row.sourceJson !== null) edge.source = row.sourceJson;
  if (row.note !== null) edge.note = row.note;
  if (row.claim !== null) edge.claim = row.claim;
  if (row.color !== null) edge.color = row.color;
  if (row.locked) edge.locked = true;
  return edge;
}

// ─── Deserialize: TimelineDoc → SQL ─────────────────────────────────────────

/**
 * Upserts a validated TimelineDoc into Postgres.
 * Replaces all nodes/edges/tracks for the given timeline (atomic).
 *
 * @param {string} timelineId - Must already exist in the `timelines` table
 * @param {object} doc - Validated TimelineDoc (from timelineValidator)
 * @param {object} [opts]
 * @param {boolean} [opts.bumpVersion=false] - Increment meta.version
 * @returns {Promise<void>}
 */
export async function deserializeTimeline(timelineId, doc, opts = {}) {
  const { bumpVersion = false } = opts;

  await prisma.$transaction(async (tx) => {
    // 1. Update timeline meta
    await tx.timeline.update({
      where: { id: timelineId },
      data: {
        title: doc.meta.title,
        author: doc.meta.author,
        schemaVersion: doc.meta.schemaVersion,
        version: bumpVersion
          ? { increment: 1 }
          : doc.meta.version,
        defaultChronology: doc.meta.defaultChronology,
        yearStart: doc.meta.yearRange[0],
        yearEnd: doc.meta.yearRange[1],
        blackAndWhite: doc.display?.blackAndWhite ?? false,
      },
    });

    // 2. Delete existing children (cascade-safe)
    await tx.node.deleteMany({ where: { timelineId } });
    await tx.edge.deleteMany({ where: { timelineId } });
    await tx.displayTrack.deleteMany({ where: { timelineId } });

    // 3. Insert nodes
    if (doc.nodes.length > 0) {
      await tx.node.createMany({
        data: doc.nodes.map((n) => mapNodeToRow(n, timelineId)),
      });
    }

    // 4. Insert edges
    if (doc.edges.length > 0) {
      await tx.edge.createMany({
        data: doc.edges.map((e) => mapEdgeToRow(e, timelineId)),
      });
    }

    // 5. Insert display tracks
    if (doc.display?.tracks?.length > 0) {
      await tx.displayTrack.createMany({
        data: doc.display.tracks.map((t) => ({
          id: t.id,
          timelineId,
          label: t.label,
          color: t.color,
          filter: t.filter,
        })),
      });
    }
  });
}

function mapNodeToRow(n, timelineId) {
  return {
    id: n.id,
    timelineId,
    kind: n.kind,
    label: n.label,
    subtype: n.subtype ?? null,
    timeJson: n.time ?? null,
    displayOrder: n.displayOrder ?? null,
    rolesJson: n.roles ?? null,
    group: n.group ?? null,
    tagsJson: n.tags ?? null,
    termsJson: n.terms ?? null,
    status: n.status ?? null,
    authorJson: n.author ?? null,
    genre: n.genre ?? null,
    eventsDescribed: n.eventsDescribed ?? null,
    trajectory: n.trajectory ?? null,
    modernName: n.modernName ?? null,
    coordsJson: n.coords ?? null,
    siteCandidatesJson: n.siteCandidates ?? null,
    image: n.image ?? null,
    ref: n.ref ?? null,
    sourceJson: n.source ?? null,
    confidence: n.confidence ?? null,
    locked: n.locked ?? false,
    note: n.note ?? null,
  };
}

function mapEdgeToRow(e, timelineId) {
  return {
    id: e.id,
    timelineId,
    fromId: e.from,
    toId: e.to,
    kind: e.kind,
    subtype: e.subtype ?? null,
    confidence: e.confidence,
    sourceJson: e.source ?? null,
    note: e.note ?? null,
    claim: e.claim ?? null,
    color: e.color ?? null,
    locked: e.locked ?? false,
  };
}

// ─── Convenience: Create new timeline + populate ────────────────────────────

/**
 * Creates a new timeline row and populates it from a doc.
 * Used by the "New timeline" dialog and template instantiation.
 *
 * @param {object} doc - Validated TimelineDoc
 * @returns {Promise<string>} The new timeline ID
 */
export async function createTimeline(doc) {
  const timelineId = crypto.randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.timeline.create({
      data: {
        id: timelineId,
        title: doc.meta.title,
        author: doc.meta.author,
        schemaVersion: doc.meta.schemaVersion,
        version: doc.meta.version,
        defaultChronology: doc.meta.defaultChronology,
        yearStart: doc.meta.yearRange[0],
        yearEnd: doc.meta.yearRange[1],
        blackAndWhite: doc.display?.blackAndWhite ?? false,
      },
    });

    if (doc.nodes.length > 0) {
      await tx.node.createMany({
        data: doc.nodes.map((n) => mapNodeToRow(n, timelineId)),
      });
    }
    if (doc.edges.length > 0) {
      await tx.edge.createMany({
        data: doc.edges.map((e) => mapEdgeToRow(e, timelineId)),
      });
    }
    if (doc.display?.tracks?.length > 0) {
      await tx.displayTrack.createMany({
        data: doc.display.tracks.map((t) => ({
          id: t.id,
          timelineId,
          label: t.label,
          color: t.color,
          filter: t.filter,
        })),
      });
    }
  });

  return timelineId;
}
