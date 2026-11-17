import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InspectorPanel from '../components/InspectorPanel.jsx';

const makeNode = (overrides = {}) => ({
    id: 'n1',
    kind: 'event',
    label: 'Exodus',
    time: { derived: { start: -1446, end: -1406 }, confidence: 'approximate' },
    ...overrides,
});

const makeEdge = (overrides = {}) => ({
    id: 'e1',
    from: 'n1',
    to: 'n2',
    kind: 'types',
    confidence: 'traditional',
    claim: 'Deliverance prefigures redemption',
    ...overrides,
});

const makeDoc = (nodes = [], edges = []) => ({
    meta: { title: 'Test', yearRange: [-2000, 0] },
    nodes,
    edges,
    display: { tracks: [] },
});

const baseProps = (node, edge, doc) => ({
    selection: node ? { type: 'node', id: node.id } : { type: 'edge', id: edge.id },
    node,
    edge,
    doc,
    dispatch: vi.fn(),
    onClose: vi.fn(),
});

describe('InspectorPanel', () => {
    it('renders node label in header', () => {
        const node = makeNode();
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} />);
        expect(screen.getByText(/Exodus/)).toBeInTheDocument();
    });

    it('renders edge kind in header', () => {
        const edge = makeEdge();
        render(<InspectorPanel {...baseProps(null, edge, makeDoc([], [edge]))} />);
        expect(screen.getByText('→ types (n1 → n2)')).toBeInTheDocument();
    });

    it('shows duration computed field for span nodes', () => {
        const node = makeNode({ kind: 'span', time: { derived: { start: -1876, end: -1446 } } });
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} />);
        expect(screen.getByText(/430 yr/)).toBeInTheDocument();
    });

    it('shows gap-to-next computed field', () => {
        const n1 = makeNode({ id: 'a', time: { derived: { start: -1446, end: -1446 } } });
        const n2 = makeNode({ id: 'b', label: 'Next', time: { derived: { start: -1046 } } });
        render(<InspectorPanel {...baseProps(n1, null, makeDoc([n1, n2]))} />);
        expect(screen.getByText(/400 yr/)).toBeInTheDocument();
    });

    it('shows lock banner when node is locked', () => {
        const node = makeNode({ locked: true });
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} />);
        expect(screen.getByText(/Locked/)).toBeInTheDocument();
        expect(screen.getByText('Unlock')).toBeInTheDocument();
    });

    it('does not show lock banner when unlocked', () => {
        const node = makeNode();
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} />);
        expect(screen.queryByText(/Locked/)).not.toBeInTheDocument();
    });

    it('shows person-specific fields (roles) for person kind', () => {
        const node = makeNode({ kind: 'person', roles: ['king', 'prophet'] });
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} />);
        expect(screen.getByText('Roles')).toBeInTheDocument();
        expect(screen.getByText('king')).toBeInTheDocument();
        expect(screen.getByText('prophet')).toBeInTheDocument();
    });

    it('shows covenant-specific fields for covenant kind', () => {
        const node = makeNode({ kind: 'covenant', status: 'active', terms: { promise: 'land' } });
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} />);
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Promise')).toBeInTheDocument();
    });

    it('shows book-specific fields for book kind', () => {
        const node = makeNode({ kind: 'book', author: { name: 'Moses', disputed: false }, genre: 'narrative' });
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} />);
        expect(screen.getByText('Genre')).toBeInTheDocument();
    });

    it('shows political-specific fields for political kind', () => {
        const node = makeNode({ kind: 'political', trajectory: 'rising' });
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} />);
        expect(screen.getByText('Trajectory')).toBeInTheDocument();
    });

    it('shows derivation steps when present', () => {
        const node = makeNode({
            time: {
                derived: { start: -1446 },
                derivation: { steps: ['Start from 1 Kgs 6:1', 'Add 40 years in wilderness'] },
            },
        });
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} />);
        expect(screen.getAllByText('Start from 1 Kgs 6:1').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Add 40 years in wilderness').length).toBeGreaterThanOrEqual(1);
    });

    it('edge inspector shows claim textarea', () => {
        const edge = makeEdge();
        render(<InspectorPanel {...baseProps(null, edge, makeDoc([], [edge]))} />);
        expect(screen.getByDisplayValue('Deliverance prefigures redemption')).toBeInTheDocument();
    });

    it('edge inspector shows connection labels', () => {
        const nodes = [makeNode({ id: 'n1', label: 'Exodus' }), makeNode({ id: 'n2', label: 'Moses' })];
        const edge = makeEdge();
        render(<InspectorPanel {...baseProps(null, edge, makeDoc(nodes, [edge]))} />);
        expect(screen.getByText('Exodus')).toBeInTheDocument();
        expect(screen.getByText('Moses')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
        const node = makeNode();
        const onClose = vi.fn();
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} onClose={onClose} />);
        fireEvent.click(screen.getByLabelText('Close inspector'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('dispatches node.update when label is edited', () => {
        const node = makeNode();
        const dispatch = vi.fn();
        render(<InspectorPanel {...baseProps(node, null, makeDoc([node]))} dispatch={dispatch} />);
        const labelInput = screen.getByDisplayValue('Exodus');
        fireEvent.change(labelInput, { target: { value: 'Exodus Event' } });
        fireEvent.blur(labelInput);
        expect(dispatch).toHaveBeenCalledWith({ type: 'node.update', id: 'n1', fields: 'label', value: 'Exodus Event' });
    });
});
