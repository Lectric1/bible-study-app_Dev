// ─── Containment Tree ──────────────────────────────────────────────────────

export function buildContainmentTree(nodes, edges) {
  const tree = new Map();
  for (const n of nodes) {
    tree.set(n.id, { parent: null, children: [] });
  }
  for (const e of edges) {
    if (e.kind !== 'contains') continue;
    const from = tree.get(e.from);
    const to = tree.get(e.to);
    if (!from || !to) continue;
    from.children.push(e.to);
    to.parent = e.from;
  }
  return tree;
}

// ─── LOD ───────────────────────────────────────────────────────────────────

export function computeLODLevel(ppy) {
  if (ppy < 0.5) return 'far';
  if (ppy < 2) return 'med-far';
  if (ppy < 10) return 'med';
  if (ppy < 50) return 'near';
  return 'close';
}

export function cullNodes(nodes, containmentTree, ppy) {
  const visible = new Set();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function visualWidth(node) {
    if (!node.time?.derived) return 8;
    const { start, end } = node.time.derived;
    if (end != null) return Math.max(4, (end - start) * ppy);
    return 8;
  }

  function isVisible(id) {
    if (visible.has(id)) return true;
    const entry = containmentTree.get(id);
    if (!entry || !entry.parent) {
      visible.add(id);
      return true;
    }
    const parentVisible = isVisible(entry.parent);
    if (!parentVisible) return false;
    const parent = nodeMap.get(entry.parent);
    const child = nodeMap.get(id);
    if (!parent || !child) { visible.add(id); return true; }
    const pw = visualWidth(parent);
    const cw = visualWidth(child);
    if (cw < 0.4 * pw && pw < 60) return false;
    visible.add(id);
    return true;
  }

  for (const n of nodes) isVisible(n.id);
  return visible;
}

// ─── Edge Color ────────────────────────────────────────────────────────────

const EDGE_COLOR_DEFAULTS = {
  causes: '#2563eb', precedes: '#2563eb', concurrent: '#2563eb',
  contains: '#2563eb', synchronizes: '#2563eb',
  responds: '#7c3aed', prophesies: '#7c3aed', fulfills: '#7c3aed',
  types: '#7c3aed', escalates: '#7c3aed', contrasts: '#7c3aed',
  covenants: '#7c3aed',
  father_of: '#059669', teacher_of: '#059669', succeeds: '#059669',
  rival_of: '#059669', allied_with: '#059669', vassal_of: '#059669',
  located_in: '#059669', governs: '#059669',
  part_of: '#6b7280', echoes: '#6b7280', references: '#6b7280',
};

export function getEdgeColor(edge) {
  return edge.color || EDGE_COLOR_DEFAULTS[edge.kind] || '#6b7280';
}

// ─── Node Shape ────────────────────────────────────────────────────────────

export function getNodeShape(node) {
  switch (node.kind) {
    case 'event':     return { type: 'circle', r: 6 };
    case 'span':      return { type: 'rect', h: 14 };
    case 'person':    return { type: 'circle', r: 5 };
    case 'place':     return { type: 'diamond', r: 7 };
    case 'covenant':  return { type: 'circle', r: 8, doubleStroke: true };
    case 'book':      return { type: 'rect', w: 16, h: 10 };
    case 'political': return { type: 'rect', h: 12, dashed: true };
    case 'theme':     return { type: 'circle', r: 6, dashed: true };
    case 'period':    return { type: 'rect', h: 20, opacity: 0.4 };
    default:          return { type: 'circle', r: 6 };
  }
}

// ─── Track Assignment ──────────────────────────────────────────────────────

export function assignTracks(nodes, display) {
  const tracks = display?.tracks || [];
  const assignment = new Map();

  for (const node of nodes) {
    let trackIdx = tracks.length;
    for (let i = 0; i < tracks.length; i++) {
      if (matchesFilter(node, tracks[i].filter)) {
        trackIdx = i;
        break;
      }
    }
    assignment.set(node.id, trackIdx);
  }
  return assignment;
}

function matchesFilter(node, filterStr) {
  if (!filterStr) return true;
  const clauses = filterStr.split(/\s+AND\s+/i);
  return clauses.every((clause) => {
    const match = clause.trim().match(/^(\w+)\s*(==|!=)\s*'([^']*)'$/);
    if (!match) return true;
    const [, field, op, value] = match;
    const nodeVal = String(node[field] ?? '');
    return op === '==' ? nodeVal === value : nodeVal !== value;
  });
}

// ─── Computed Gaps ─────────────────────────────────────────────────────────

export function computeGaps(sortedNodes) {
  const timed = sortedNodes.filter((n) => n.time?.derived?.start != null);
  const gaps = [];
  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i];
    const b = timed[i + 1];
    const aEnd = a.time?.derived?.end ?? a.time?.derived?.start;
    const bStart = b.time?.derived?.start;
    const gap = bStart - aEnd;
    if (gap > 0) gaps.push({ fromId: a.id, toId: b.id, gapYears: gap });
  }
  return gaps;
}   

// ─── Time Axis ─────────────────────────────────────────────────────────────

export function timeTicks(yearStart, yearEnd, targetCount = 10) {
  const range = yearEnd - yearStart;
  const rawStep = range / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let step;
  if (residual <= 1.5) step = magnitude;
  else if (residual <= 3.5) step = 2 * magnitude;
  else if (residual <= 7.5) step = 5 * magnitude;
  else step = 10 * magnitude;

  const ticks = [];
  let t = Math.ceil(yearStart / step) * step;
  while (t <= yearEnd) {
    ticks.push(t);
    t += step;
  }
  return ticks;
}

export function formatYear(year) {
  if (year < 0) return `${Math.abs(year)} BC`;
  if (year === 0) return '1 BC';
  return `${year} AD`;
}

// ─── Kind Fill ─────────────────────────────────────────────────────────────

export function getKindFill(kind) {
  const fills = {
    event: '#3b82f6',
    span: '#60a5fa',
    person: '#f59e0b',
    place: '#10b981',
    covenant: '#8b5cf6',
    book: '#6b7280',
    political: '#ef4444',
    theme: '#a78bfa',
    period: '#d1d5db',
  };
  return fills[kind] || '#6b7280';
}
