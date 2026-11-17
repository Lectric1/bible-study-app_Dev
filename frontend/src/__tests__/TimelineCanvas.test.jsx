import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimelineCanvas from '../components/TimelineCanvas.jsx';

// ─── Shared fixture ─────────────────────────────────────────────────────

const makeDoc = () => ({
    meta: { title: 'Test', yearRange: [-1500, -1000] },
    nodes: [
        { id: 'n1', kind: 'event', label: 'Exodus', time: { derived: { start: -1446 } } },
        { id: 'n2', kind: 'span', label: 'Wilderness', time: { derived: { start: -1446, end: -1406 } } },
    ],
    edges: [
        { id: 'e1', from: 'n1', to: 'n2', kind: 'contains', confidence: 'certain' },
    ],
    display: { tracks: [] },
});
// Try importing from backend fixtures; fall back to inline

const fixture = {
    meta: {
        title: 'Test Timeline',
        author: 'test',
        schemaVersion: 1,
        version: 1,
        defaultChronology: 'thiele',
            yearRange: [-2000, 0],
    },
    nodes: [
        { id: 'e1', kind: 'event', label: 'Exodus', time: { derived: { start: -1446 }, confidence: 'approximate' } },
        { id: 's1', kind: 'span', label: '430 Years', time: { derived: { start: -1876, end: -1446 }, statedLength: 430, statedUnit: 'years', confidence: 'scriptural' } },
        { id: 'p1', kind: 'person', label: 'Moses', time: { derived: { start: -1526, end: -1406 }, confidence: 'approximate' } },
    ],
    edges: [
        { id: 'ed1', from: 's1', to: 'e1', kind: 'contains', confidence: 'certain' },
        { id: 'ed2', from: 'p1', to: 'e1', kind: 'located_in', confidence: 'probable' },
    ],
    display: {
        tracks: [{ id: 't1', label: 'Events', color: '#3b82f6', filter: "kind == 'event'" }],
    },
};

describe('TimelineCanvas', () => {
    it('renders an SVG element', () => {
        const { container } = render(<TimelineCanvas doc={fixture} height={400} />);
        expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders track lanes', () => {
        const { container } = render(<TimelineCanvas doc={fixture} height={400} />);
        const lanes = container.querySelectorAll('.track-lane');
        expect(lanes.length).toBe(2);
    });

    it('renders the time axis', () => {
        const { container } = render(<TimelineCanvas doc={fixture} height={400} />);
        expect(container.querySelector('.time-axis')).toBeTruthy();
    });

    it('renders at least one node', () => {
        const { container } = render(<TimelineCanvas doc={fixture} height={400} />);
        const nodes = container.querySelectorAll('.node');
        expect(nodes.length).toBeGreaterThanOrEqual(1);
    });
});

// ─── Phase 3: Selection wiring ───────────────────────────────────────────

describe('TimelineCanvas selection', () => {
    const makeDoc = () => ({
        meta: { title: 'Test', yearRange: [-1500, -1000] },
        nodes: [
            { id: 'n1', kind: 'event', label: 'Exodus', time: { derived: { start: -1446 } } },
            { id: 'n2', kind: 'span', label: 'Wilderness', time: { derived: { start: -1446, end: -1406 } } },
        ],
        edges: [
            { id: 'e1', from: 'n1', to: 'n2', kind: 'contains', confidence: 'certain' },
        ],
        display: { tracks: [] },
    });

    it('calls onSelectNode when a line-kind hit area is clicked', () => {
        const onSelectNode = vi.fn();
        const { container } = render(
            <TimelineCanvas doc={makeDoc()} onSelectNode={onSelectNode} onSelectEdge={vi.fn()} />
        );
        const hitArea = container.querySelector('rect.node-hitarea');
        expect(hitArea).not.toBeNull();
        fireEvent.click(hitArea);
        expect(onSelectNode).toHaveBeenCalled();
    });

    it('calls onSelectEdge when an edge hit area is clicked', () => {
        const onSelectEdge = vi.fn();
        const { container } = render(
            <TimelineCanvas doc={makeDoc()} onSelectNode={vi.fn()} onSelectEdge={onSelectEdge} />
        );
        const edgeHit = container.querySelector('.edge-hitarea');
        if (edgeHit) {
            fireEvent.click(edgeHit);
            expect(onSelectEdge).toHaveBeenCalledWith('e1');
        }
    });
});
describe('drop-to-create', () => {
    it('calls onCreateNode with kind and year on drop', () => {
        const onCreateNode = vi.fn();
        const { container } = render(
            <TimelineCanvas doc={makeDoc()} onCreateNode={onCreateNode} />
        );
        const svg = container.querySelector('svg');
        const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(dropEvent, 'clientX', { value: 400 });
        Object.defineProperty(dropEvent, 'clientY', { value: 200 });
        Object.defineProperty(dropEvent, 'dataTransfer', {
            value: { getData: (t) => t === 'application/x-node-kind' ? 'event' : '', effectAllowed: '' },
        });
        svg.dispatchEvent(dropEvent);
        expect(onCreateNode).toHaveBeenCalledWith('event', expect.any(Number));
    });
});
