import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client.js';
import { useTimelineStore } from '../store/timelineStore.js';
import TimelineCanvas from './TimelineCanvas.jsx';
import NodeMinimenu from './NodeMinimenu';
import InspectorPanel from './InspectorPanel.jsx';
import NodePalette from './NodePalette.jsx';
import { createNode, createEdge } from '../utils/timelineUtils.js';
import EdgeCreateDialog from './EdgeCreateDialog';
import TrackManager from './TrackManager';

export default function TimelineTab({ isLoggedIn }) {
    const [timelines, setTimelines] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [minimenu, setMinimenu] = useState(null);
    const [doc, setDoc] = useState(null);
    const [pendingEdge, setPendingEdge] = useState(null); // { fromId, toId }

    const store = useTimelineStore(null);

    const handleClusterTap = useCallback(({ x, y, nodes }) => {
        setMinimenu({ x, y, nodes });
    }, []);

    const closeMinimenu = useCallback(() => setMinimenu(null), []);

    const handleSelect = useCallback((node) => {
        store.select('node', node.id);
        setMinimenu(null);
    }, [store]);

    const handleSelectNode = useCallback((id) => {
        store.select('node', id);
    }, [store]);

    const handleSelectEdge = useCallback((id) => {
        store.select('edge', id);
    }, [store]);
    const handleCreateNode = useCallback((kind, year) => {
        if (!store.doc) return;
        const nodes = store.doc.nodes;
        const centerYear = year ?? Math.round(
            (store.doc.meta.yearRange[0] + store.doc.meta.yearRange[1]) / 2
        );
        const node = createNode(kind, centerYear, nodes);
        store.dispatch({ type: 'node.create', node });
        store.select('node', node.id);
    }, [store]);
    const handleCreateEdge = useCallback((fromId, toId) => {
        setPendingEdge({ fromId, toId });
    }, []);

    const confirmCreateEdge = useCallback((extras) => {
        if (!pendingEdge) return;
        const edge = createEdge(
            pendingEdge.fromId,
            pendingEdge.toId,
            extras.kind,
            extras.confidence,
            store.doc.edges,
            extras
        );
        store.dispatch({ type: 'edge.create', edge });
        store.select('edge', edge.id);
        setPendingEdge(null);
    }, [pendingEdge, store]);

    // Sync store when doc loads
    const prevDocRef = useRef(null);
    useEffect(() => {
        if (doc && doc !== prevDocRef.current) {
            prevDocRef.current = doc;
            store.setDocument(doc);
        }
    }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

        useEffect(() => {
            if (!isLoggedIn) return;
            setLoading(true);
            api.listTimelines()
            .then(setTimelines)
            .catch((e) => setError(e))
            .finally(() => setLoading(false));
        }, [isLoggedIn]);

        useEffect(() => {
            if (!timelines.length) { setDoc(null); return; }
            const id = selectedId || timelines[0].id;
            setLoading(true);
            api.getTimeline(id)
            .then(setDoc)
            .catch((e) => setError(e))
            .finally(() => setLoading(false));
        }, [selectedId, timelines]);

        if (!isLoggedIn) {
            return (
                <div className="flex h-full items-center justify-center">
                <p className="text-sm text-gray-400">Sign in to view timelines.</p>
                </div>
            );
        }

        if (loading) {
            return (
                <div className="flex h-full items-center justify-center">
                <p className="text-sm text-gray-500 animate-pulse">Loading timeline…</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                <p className="text-sm text-red-500">{error.message}</p>
                <button
                className="text-xs text-blue-500 hover:underline"
                onClick={() => { setError(null); setSelectedId(null); }}
                >
                Retry
                </button>
                </div>
            );
        }

        if (!doc) {
            return (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                <p className="text-sm text-gray-500">No timeline open.</p>
                </div>
            );
        }

        const hasSelection = store.selection != null;

        return (
            <div className="flex h-full">
            {/* Left panel */}
            <div className="w-56 border-r border-rule flex flex-col shrink-0 overflow-y-auto">
            {/* Timeline switcher */}
            {timelines.length > 1 && (
                <div className="border-b border-rule px-3 py-2">
                <select
                className="text-xs w-full border border-rule rounded px-1.5 py-1 bg-ink text-parchment focus:border-brass focus:outline-none"
                value={selectedId || timelines[0].id}
                onChange={(e) => setSelectedId(e.target.value)}
                >
                {timelines.map((t) => (
                    <option key={t.id} value={t.id}>
                    {t.title}{t.shared ? ' (shared)' : ''}
                    </option>
                ))}
                </select>
                </div>
            )}

            {/* Node palette (vertical) */}
            <div className="border-b border-rule px-3 py-2">
            <NodePalette onCreate={handleCreateNode} vertical />
            </div>

            {/* Tracks */}
            <div className="px-3 py-2">
            <TrackManager
            tracks={store.doc?.display?.tracks || []}
            dispatch={store.dispatch}
            />
            </div>
            </div>

            {/* Right side: canvas + inspector */}
            <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-hidden relative">
            <TimelineCanvas
            doc={store.doc || doc}
            height={600}
            onClusterTap={handleClusterTap}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            onCreateNode={handleCreateNode}
            selectedNodeId={store.selection?.type === 'node' ? store.selection.id : null}
            onCreateEdge={handleCreateEdge}
            />
            {pendingEdge && (
                <EdgeCreateDialog
                fromLabel={store.doc.nodes.find((n) => n.id === pendingEdge.fromId)?.label || pendingEdge.fromId}
                toLabel={store.doc.nodes.find((n) => n.id === pendingEdge.toId)?.label || pendingEdge.toId}
                onConfirm={confirmCreateEdge}
                onCancel={() => setPendingEdge(null)}
                />
            )}
            {minimenu && (
                <NodeMinimenu
                position={minimenu}
                nodes={minimenu.nodes}
                onSelect={handleSelect}
                onClose={closeMinimenu}
                />
            )}
            </div>

            {/* Inspector */}
            <div
            className="border-t border-rule transition-all duration-200 overflow-hidden"
            style={{ height: hasSelection ? 200 : 32 }}
            >
            {hasSelection ? (
                <InspectorPanel
                selection={store.selection}
                node={store.selectedNode}
                edge={store.selectedEdge}
                doc={store.doc}
                dispatch={store.dispatch}
                onClose={store.clearSelection}
                />
            ) : (
                <div className="flex h-full items-center justify-center">
                <span className="text-xs text-muted">Inspector — click a node or edge</span>
                </div>
            )}
            </div>
            </div>
            </div>
        );
}
