import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TimelineCanvas from '../components/TimelineCanvas.jsx';

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

