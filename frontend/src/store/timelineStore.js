import { useState, useCallback, useMemo } from 'react';

function setByPath(obj, path, value) {
    const keys = path.split('.');
    const clone = { ...obj };
    let cur = clone;
    for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] == null) cur[keys[i]] = {};
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    return clone;
}

function applyCommand(doc, command) {
    switch (command.type) {
        case 'node.update': {
            const nodes = doc.nodes.map((n) =>
            n.id === command.id ? setByPath(n, command.fields, command.value) : n
            );
            return { ...doc, nodes };
        }
        case 'edge.update': {
            const edges = doc.edges.map((e) =>
            e.id === command.id ? setByPath(e, command.fields, command.value) : e
            );
            return { ...doc, edges };
        }
        case 'node.create': {
            return { ...doc, nodes: [...doc.nodes, command.node] };
        }
        case 'edge.create': {
            return { ...doc, edges: [...doc.edges, command.edge] };
        }
        case 'track.add': {
            const tracks = [...(doc.display?.tracks || []), command.track];
            return { ...doc, display: { ...(doc.display || {}), tracks } };
        }
        case 'track.remove': {
            const tracks = (doc.display?.tracks || []).filter((t) => t.id !== command.id);
            return { ...doc, display: { ...(doc.display || {}), tracks } };
        }
        case 'track.update': {
            const tracks = (doc.display?.tracks || []).map((t) =>
            t.id === command.id ? { ...t, ...command.patch } : t
            );
            return { ...doc, display: { ...(doc.display || {}), tracks } };
        }
        default:
            return doc;
    }
}

export function useTimelineStore(initialDoc) {
    const [doc, setDoc] = useState(initialDoc);
    const [selection, setSelection] = useState(null);
    const [dirty, setDirty] = useState(false);

    // Re-sync when a new doc is loaded (timeline switch)
    const setDocument = useCallback((newDoc) => {
        setDoc(newDoc);
        setSelection(null);
        setDirty(false);
    }, []);

    const dispatch = useCallback((command) => {
        setDoc((prev) => applyCommand(prev, command));
        setDirty(true);
    }, []);

    const select = useCallback((type, id) => {
        setSelection({ type, id });
    }, []);

    const clearSelection = useCallback(() => setSelection(null), []);

    const selectedNode = useMemo(() => {
        if (!selection || selection.type !== 'node') return null;
        return doc?.nodes?.find((n) => n.id === selection.id) || null;
    }, [selection, doc]);

    const selectedEdge = useMemo(() => {
        if (!selection || selection.type !== 'edge') return null;
        return doc?.edges?.find((e) => e.id === selection.id) || null;
    }, [selection, doc]);

    return {
        doc,
        setDocument,
        dispatch,
        selection,
        select,
        clearSelection,
        selectedNode,
        selectedEdge,
        dirty,
    };
}


