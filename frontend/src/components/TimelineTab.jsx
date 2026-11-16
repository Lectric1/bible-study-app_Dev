import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import TimelineCanvas from './TimelineCanvas.jsx';

export default function TimelineTab({ isLoggedIn }) {
    const [timelines, setTimelines] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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

    return (
        <div className="flex h-full flex-col">
        {timelines.length > 1 && (
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2">
            <select
            className="text-sm border rounded px-2 py-1"
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
        <div className="flex-1 overflow-hidden">
        <TimelineCanvas doc={doc} height={500} />
        </div>
        </div>
    );
}
