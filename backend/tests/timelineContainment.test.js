import { describe, it, expect } from 'vitest';
import { buildContainmentTree, cullByContainment } from '../utils/timelineContainmentUtil.js';

// Mock a simple d3-like scale
function mockScale(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const scale = (year) => r0 + ((year - d0) / (d1 - d0)) * (r1 - r0);
  return scale;
}

describe('buildContainmentTree', () => {
  it('builds parent→child from contains edges', () => {
    const nodes = [
      { id: 'period', kind: 'period' },
      { id: 'span', kind: 'span' },
      { id: 'event', kind: 'event' },
    ];
    const edges = [
      { id: 'e1', from: 'period', to: 'span', kind: 'contains' },
      { id: 'e2', from: 'span', to: 'event', kind: 'contains' },
    ];
    const tree = buildContainmentTree(nodes, edges);
    expect(tree.get('period')).toBe(null);
    expect(tree.get('span')).toBe('period');
    expect(tree.get('event')).toBe('span');
  });

  it('ignores non-contains edges', () => {
    const nodes = [{ id: 'a', kind: 'event' }, { id: 'b', kind: 'event' }];
    const edges = [{ id: 'e1', from: 'a', to: 'b', kind: 'precedes' }];
    const tree = buildContainmentTree(nodes, edges);
    expect(tree.get('a')).toBe(null);
    expect(tree.get('b')).toBe(null);
  });

  it('ignores edges referencing unknown nodes', () => {
    const nodes = [{ id: 'a', kind: 'event' }];
    const edges = [{ id: 'e1', from: 'ghost', to: 'a', kind: 'contains' }];
    const tree = buildContainmentTree(nodes, edges);
    expect(tree.get('a')).toBe(null);
  });
});

describe('cullByContainment', () => {
  it('shows all nodes at high zoom (close)', () => {
    const nodes = [
      { id: 'span', kind: 'span', time: { derived: { start: -2000, end: -1000 } } },
      { id: 'event', kind: 'event', time: { derived: { start: -1500 } } },
    ];
    const edges = [{ id: 'e1', from: 'span', to: 'event', kind: 'contains' }];
    const tree = buildContainmentTree(nodes, edges);
    const xScale = mockScale([-2000, -1000], [0, 2000]); // 2px/year → wide
    const visible = cullByContainment(nodes, tree, 2, xScale);
    expect(visible.has('span')).toBe(true);
    expect(visible.has('event')).toBe(true);
  });

  it('absorbs small children into small parents at low zoom', () => {
    const nodes = [
      { id: 'span', kind: 'span', time: { derived: { start: -2000, end: -1990 } } },
      { id: 'event', kind: 'event', time: { derived: { start: -1995 } } },
    ];
    const edges = [{ id: 'e1', from: 'span', to: 'event', kind: 'contains' }];
    const tree = buildContainmentTree(nodes, edges);
    // 0.1px/year → span is 1px wide, event is 8px dot
    const xScale = mockScale([-2000, -1990], [0, 1]);
    const visible = cullByContainment(nodes, tree, 0.1, xScale);
    expect(visible.has('span')).toBe(true);
    expect(visible.has('event')).toBe(false); // absorbed
  });

  it('hides children when parent is hidden (recursive)', () => {
    const nodes = [
      { id: 'period', kind: 'period', time: { derived: { start: -3000, end: -1000 } } },
      { id: 'span', kind: 'span', time: { derived: { start: -2000, end: -1990 } } },
      { id: 'event', kind: 'event', time: { derived: { start: -1995 } } },
    ];
    const edges = [
      { id: 'e1', from: 'period', to: 'span', kind: 'contains' },
      { id: 'e2', from: 'span', to: 'event', kind: 'contains' },
    ];
    const tree = buildContainmentTree(nodes, edges);
    // Very low zoom: period is 2px, span is 0.1px, event is 8px
    const xScale = mockScale([-3000, -1000], [0, 2]);
    const visible = cullByContainment(nodes, tree, 0.001, xScale);
    expect(visible.has('period')).toBe(true);
    expect(visible.has('span')).toBe(false);
    expect(visible.has('event')).toBe(false);
  });
});
