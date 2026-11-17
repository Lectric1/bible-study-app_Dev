import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimelineStore } from '../../store/timelineStore.js';

const makeDoc = (overrides = {}) => ({
    meta: { title: 'Test', author: 'x', schemaVersion: 1, version: 1, defaultChronology: 'thiele', yearRange: [-2000, 0] },
    nodes: [
        { id: 'n1', kind: 'event', label: 'Exodus', time: { derived: { start: -1446, end: -1406 }, confidence: 'approximate' } },
        { id: 'n2', kind: 'person', label: 'Moses', time: { derived: { start: -1526, end: -1406 } } },
        { id: 'n3', kind: 'covenant', label: 'Mosaic', status: 'active' },
    ],
    edges: [
        { id: 'e1', from: 'n1', to: 'n2', kind: 'types', confidence: 'traditional', claim: 'prefigures' },
    ],
    display: { tracks: [] },
    ...overrides,
});

describe('useTimelineStore', () => {
    it('initializes with null doc and no selection', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        expect(result.current.doc).toBeNull();
        expect(result.current.selection).toBeNull();
        expect(result.current.dirty).toBe(false);
    });

    it('setDocument populates doc and clears selection', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        const doc = makeDoc();

        act(() => result.current.setDocument(doc));

        expect(result.current.doc).toEqual(doc);
        expect(result.current.selection).toBeNull();
        expect(result.current.dirty).toBe(false);
    });

    it('dispatch node.update changes the correct node field', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        act(() => result.current.setDocument(makeDoc()));

        act(() => result.current.dispatch({ type: 'node.update', id: 'n1', fields: 'label', value: 'Exodus Event' }));

        const n1 = result.current.doc.nodes.find((n) => n.id === 'n1');
        expect(n1.label).toBe('Exodus Event');
        expect(result.current.dirty).toBe(true);
    });

    it('dispatch node.update with deep path', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        act(() => result.current.setDocument(makeDoc()));

        act(() => result.current.dispatch({ type: 'node.update', id: 'n1', fields: 'time.derived.start', value: -1447 }));

        const n1 = result.current.doc.nodes.find((n) => n.id === 'n1');
        expect(n1.time.derived.start).toBe(-1447);
        expect(n1.time.derived.end).toBe(-1406); // unchanged
    });

    it('dispatch edge.update changes the correct edge field', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        act(() => result.current.setDocument(makeDoc()));

        act(() => result.current.dispatch({ type: 'edge.update', id: 'e1', fields: 'confidence', value: 'certain' }));

        const e1 = result.current.doc.edges.find((e) => e.id === 'e1');
        expect(e1.confidence).toBe('certain');
        expect(e1.claim).toBe('prefigures'); // unchanged
    });

    it('dispatch does not mutate the original doc object', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        const doc = makeDoc();
        act(() => result.current.setDocument(doc));

        act(() => result.current.dispatch({ type: 'node.update', id: 'n1', fields: 'label', value: 'Changed' }));

        expect(doc.nodes[0].label).toBe('Exodus'); // original untouched
        expect(result.current.doc.nodes[0].label).toBe('Changed');
    });

    it('select sets selection and selectedNode resolves', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        act(() => result.current.setDocument(makeDoc()));

        act(() => result.current.select('node', 'n2'));

        expect(result.current.selection).toEqual({ type: 'node', id: 'n2' });
        expect(result.current.selectedNode?.label).toBe('Moses');
        expect(result.current.selectedEdge).toBeNull();
    });

    it('select edge resolves selectedEdge', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        act(() => result.current.setDocument(makeDoc()));

        act(() => result.current.select('edge', 'e1'));

        expect(result.current.selectedEdge?.kind).toBe('types');
        expect(result.current.selectedNode).toBeNull();
    });

    it('clearSelection removes selection', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        act(() => result.current.setDocument(makeDoc()));
        act(() => result.current.select('node', 'n1'));
        act(() => result.current.clearSelection());

        expect(result.current.selection).toBeNull();
        expect(result.current.selectedNode).toBeNull();
    });

    it('selectedNode is null when selection id doesn\'t exist in doc', () => {
        const { result } = renderHook(() => useTimelineStore(null));
        act(() => result.current.setDocument(makeDoc()));

        act(() => result.current.select('node', 'nonexistent'));

        expect(result.current.selectedNode).toBeNull();
    });
});

describe('node.create', () => {
    it('adds a node to doc.nodes', () => {
        const { result } = renderHook(() => useTimelineStore(makeDoc()));
        const initialCount = result.current.doc.nodes.length;
        const node = { id: 'evt-99', kind: 'event', label: 'Test', time: { derived: { start: -1446, end: -1446 }, confidence: 'undated' } };
        act(() => {
            result.current.dispatch({ type: 'node.create', node });
        });
        expect(result.current.doc.nodes).toHaveLength(initialCount + 1);
        expect(result.current.doc.nodes[initialCount]).toEqual(node);
    });

    it('sets dirty to true', () => {
        const { result } = renderHook(() => useTimelineStore(makeDoc()));
        expect(result.current.dirty).toBe(false);
        act(() => {
            result.current.dispatch({ type: 'node.create', node: { id: 'x', kind: 'event', label: 'X' } });
        });
        expect(result.current.dirty).toBe(true);
    });
});

describe('edge.create command', () => {
    it('appends edge to doc.edges', () => {
        const { result } = renderHook(() => useTimelineStore(makeDoc()));
        const before = result.current.doc.edges.length;
        const edge = { id: 'edge-99', from: 'evt-1', to: 'evt-2', kind: 'precedes', confidence: 'probable' };
        act(() => { result.current.dispatch({ type: 'edge.create', edge }); });
        expect(result.current.doc.edges).toHaveLength(before + 1);
        expect(result.current.doc.edges[before]).toEqual(edge);
        expect(result.current.dirty).toBe(true);
    });
});

describe('track commands', () => {
    it('track.add appends to display.tracks', () => {
        const { result } = renderHook(() => useTimelineStore(makeDoc()));
        const track = { id: 'track-1', label: 'Test', color: '#fff', filter: '', visible: true };
        act(() => { result.current.dispatch({ type: 'track.add', track }); });
        expect(result.current.doc.display.tracks).toHaveLength(1);
        expect(result.current.doc.display.tracks[0]).toEqual(track);
    });

    it('track.remove deletes by id', () => {
        const { result } = renderHook(() => useTimelineStore(makeDoc()));
        act(() => { result.current.dispatch({ type: 'track.add', track: { id: 'track-1', label: 'A', color: '#fff', filter: '', visible: true } }); });
        act(() => { result.current.dispatch({ type: 'track.remove', id: 'track-1' }); });
        expect(result.current.doc.display.tracks).toHaveLength(0);
    });

    it('track.update patches fields', () => {
        const { result } = renderHook(() => useTimelineStore(makeDoc()));
        act(() => { result.current.dispatch({ type: 'track.add', track: { id: 'track-1', label: 'A', color: '#fff', filter: '', visible: true } }); });
        act(() => { result.current.dispatch({ type: 'track.update', id: 'track-1', patch: { visible: false } }); });
        expect(result.current.doc.display.tracks[0].visible).toBe(false);
    });
});
