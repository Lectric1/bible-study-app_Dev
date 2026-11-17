import { describe, it, expect } from 'vitest';
import {
    buildContainmentTree, computeLODLevel, cullNodes,
    getEdgeColor, getNodeShape, assignTracks, computeGaps,
    timeTicks, formatYear, generateNodeId, defaultLabel,
    createNode, generateEdgeId, createEdge, createTrack,
    generateTrackId,
} from '../../utils/timelineUtils.js';


describe('buildContainmentTree', () => {
  it('builds parent-child from contains edges', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { from: 'a', to: 'b', kind: 'contains' },
      { from: 'b', to: 'c', kind: 'contains' },
    ];
    const tree = buildContainmentTree(nodes, edges);
    expect(tree.get('b').parent).toBe('a');
    expect(tree.get('c').parent).toBe('b');
    expect(tree.get('a').parent).toBeNull();
    expect(tree.get('a').children).toEqual(['b']);
  });

  it('ignores non-contains edges', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [{ from: 'a', to: 'b', kind: 'causes' }];
    const tree = buildContainmentTree(nodes, edges);
    expect(tree.get('b').parent).toBeNull();
  });
});

describe('computeLODLevel', () => {
  it('returns correct level for boundary values', () => {
    expect(computeLODLevel(0.1)).toBe('far');
    expect(computeLODLevel(0.49)).toBe('far');
    expect(computeLODLevel(0.5)).toBe('med-far');
    expect(computeLODLevel(1.9)).toBe('med-far');
    expect(computeLODLevel(2)).toBe('med');
    expect(computeLODLevel(9.9)).toBe('med');
    expect(computeLODLevel(10)).toBe('near');
    expect(computeLODLevel(49)).toBe('near');
    expect(computeLODLevel(50)).toBe('close');
    expect(computeLODLevel(100)).toBe('close');
  });
});

describe('cullNodes', () => {
  it('hides child when < 40% of parent AND parent < 60px', () => {
    const nodes = [
      { id: 'parent', kind: 'span', time: { derived: { start: -100, end: -90 } } },
      { id: 'child', kind: 'event', time: { derived: { start: -95 } } },
    ];
    const edges = [{ from: 'parent', to: 'child', kind: 'contains' }];
    const tree = buildContainmentTree(nodes, edges);
    // ppy=3: parent=30px (<60), child=8px. 8 < 0.4*30=12 → hidden
    const visible = cullNodes(nodes, tree, 3);
    expect(visible.has('parent')).toBe(true);
    expect(visible.has('child')).toBe(false);
  });

  it('hides grandchild when parent is hidden', () => {
    const nodes = [
      { id: 'grand', kind: 'period', time: { derived: { start: -100, end: -90 } } },
      { id: 'mid', kind: 'span', time: { derived: { start: -98, end: -97 } } },
      { id: 'leaf', kind: 'event', time: { derived: { start: -97.5 } } },
    ];
    const edges = [
      { from: 'grand', to: 'mid', kind: 'contains' },
      { from: 'mid', to: 'leaf', kind: 'contains' },
    ];
    const tree = buildContainmentTree(nodes, edges);
    // ppy=3: grand=30px, mid=3px. 3 < 0.4*30=12 → mid hidden.
    // leaf: parent (mid) hidden → leaf hidden.
    const visible = cullNodes(nodes, tree, 3);
    expect(visible.has('grand')).toBe(true);
    expect(visible.has('mid')).toBe(false);
    expect(visible.has('leaf')).toBe(false);
  });

  it('shows all nodes at high zoom', () => {
    const nodes = [
      { id: 'parent', kind: 'span', time: { derived: { start: -100, end: -90 } } },
      { id: 'child', kind: 'event', time: { derived: { start: -95 } } },
    ];
    const edges = [{ from: 'parent', to: 'child', kind: 'contains' }];
    const tree = buildContainmentTree(nodes, edges);
    // ppy=100: parent=1000px (>60) → no cull
    const visible = cullNodes(nodes, tree, 100);
    expect(visible.has('parent')).toBe(true);
    expect(visible.has('child')).toBe(true);
  });
});

describe('getEdgeColor', () => {
  it('returns edge.color if set', () => {
    expect(getEdgeColor({ kind: 'causes', color: '#ff0000' })).toBe('#ff0000');
  });
  it('returns kind default when color absent', () => {
    expect(getEdgeColor({ kind: 'causes' })).toBe('#2563eb');
    expect(getEdgeColor({ kind: 'types' })).toBe('#7c3aed');
    expect(getEdgeColor({ kind: 'father_of' })).toBe('#059669');
    expect(getEdgeColor({ kind: 'part_of' })).toBe('#6b7280');
  });
});

describe('getNodeShape', () => {
  it('returns correct shape per kind', () => {
    expect(getNodeShape({ kind: 'event' }).type).toBe('circle');
    expect(getNodeShape({ kind: 'span' }).type).toBe('rect');
    expect(getNodeShape({ kind: 'place' }).type).toBe('diamond');
    expect(getNodeShape({ kind: 'period' }).opacity).toBe(0.4);
  });
});

describe('assignTracks', () => {
  it('assigns matching nodes to correct track', () => {
    const nodes = [
      { id: 'a', kind: 'person', group: 'kings' },
      { id: 'b', kind: 'event' },
    ];
    const display = {
      tracks: [{ id: 't1', label: 'Kings', color: '#f00', filter: "kind == 'person' AND group == 'kings'" }],
    };
    const result = assignTracks(nodes, display);
    expect(result.get('a')).toBe(0);
    expect(result.get('b')).toBe(1);
  });

  it('puts all nodes in default lane when no tracks', () => {
    const nodes = [{ id: 'a', kind: 'event' }];
    const result = assignTracks(nodes, undefined);
    expect(result.get('a')).toBe(0);
  });
});

describe('computeGaps', () => {
  it('computes year gaps between consecutive nodes', () => {
    const nodes = [
      { id: 'a', time: { derived: { start: -2000, end: -1900 } } },
      { id: 'b', time: { derived: { start: -1500 } } },
      { id: 'c', time: { derived: { start: -1000 } } },
    ];
    const gaps = computeGaps(nodes);
    expect(gaps).toEqual([
      { fromId: 'a', toId: 'b', gapYears: 400 },
      { fromId: 'b', toId: 'c', gapYears: 500 },
    ]);
  });

  it('skips nodes without time', () => {
    const nodes = [
      { id: 'a', time: { derived: { start: -2000 } } },
      { id: 'b' },
      { id: 'c', time: { derived: { start: -1000 } } },
    ];
    const gaps = computeGaps(nodes);
    expect(gaps).toEqual([{ fromId: 'a', toId: 'c', gapYears: 1000 }]);
  });
});

describe('timeTicks', () => {
  it('generates reasonable ticks for 3000-year range', () => {
    const ticks = timeTicks(-2000, 1000, 10);
    expect(ticks.length).toBeGreaterThanOrEqual(5);
    expect(ticks.length).toBeLessThanOrEqual(20);
    expect(ticks[0]).toBeGreaterThanOrEqual(-2000);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(1000);
  });
});

describe('formatYear', () => {
  it('formats BC and AD correctly', () => {
    expect(formatYear(-1446)).toBe('1446 BC');
    expect(formatYear(0)).toBe('1 BC');
    expect(formatYear(30)).toBe('30 AD');
  });
});

describe('generateNodeId', () => {
  it('returns kind-1 when no conflicts', () => {
    expect(generateNodeId('event', [])).toBe('evt-1');
  });
  it('increments past existing IDs', () => {
    const nodes = [{ id: 'evt-1' }, { id: 'evt-2' }];
    expect(generateNodeId('event', nodes)).toBe('evt-3');
  });
  it('uses kind-specific prefix', () => {
    expect(generateNodeId('person', [])).toBe('person-1');
    expect(generateNodeId('covenant', [])).toBe('cov-1');
  });
});

describe('defaultLabel', () => {
  it('returns correct label for each kind', () => {
    expect(defaultLabel('event')).toBe('New Event');
    expect(defaultLabel('person')).toBe('New Person');
    expect(defaultLabel('period')).toBe('New Period');
  });
});

describe('createNode', () => {
  it('creates a valid node object', () => {
    const node = createNode('event', -1446, []);
    expect(node.id).toBe('evt-1');
    expect(node.kind).toBe('event');
    expect(node.label).toBe('New Event');
    expect(node.time.derived.start).toBe(-1446);
    expect(node.time.derived.end).toBe(-1446);
    expect(node.time.confidence).toBe('undated');
  });
  it('avoids ID collision', () => {
    const existing = [{ id: 'evt-1' }];
    const node = createNode('event', -100, existing);
    expect(node.id).toBe('evt-2');
  });
});
describe('generateEdgeId', () => {
  it('returns edge-1 when no edges exist', () => {
    expect(generateEdgeId([])).toBe('edge-1');
  });
  it('skips taken ids', () => {
    const edges = [{ id: 'edge-1' }, { id: 'edge-2' }];
    expect(generateEdgeId(edges)).toBe('edge-3');
  });
});

describe('createEdge', () => {
  it('creates a minimal edge', () => {
    const e = createEdge('a', 'b', 'precedes', 'probable', []);
    expect(e).toEqual({ id: 'edge-1', from: 'a', to: 'b', kind: 'precedes', confidence: 'probable' });
  });
  it('includes optional extras', () => {
    const e = createEdge('a', 'b', 'types', 'traditional', [], { color: '#ff0000', subtype: 'miracle' });
    expect(e.color).toBe('#ff0000');
    expect(e.subtype).toBe('miracle');
  });
});

describe('generateTrackId', () => {
  it('returns track-1 when no tracks exist', () => {
    expect(generateTrackId([])).toBe('track-1');
  });
  it('skips taken ids', () => {
    expect(generateTrackId([{ id: 'track-1' }])).toBe('track-2');
  });
});

describe('createTrack', () => {
  it('creates a track with defaults', () => {
    const t = createTrack('Kings', '#2563eb', '', []);
    expect(t).toEqual({ id: 'track-1', label: 'Kings', color: '#2563eb', filter: '', visible: true });
  });
});

