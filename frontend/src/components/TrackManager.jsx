import { useState } from 'react';
import { Plus, X, Eye, EyeOff } from 'lucide-react';
import { createTrack } from '../utils/timelineUtils.js';

const TRACK_COLORS = [
  '#2563eb', '#7c3aed', '#059669', '#ef4444',
  '#f59e0b', '#ec4899', '#06b6d4', '#84cc16',
];

export default function TrackManager({ tracks, dispatch, nodeCount }) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(TRACK_COLORS[0]);
  const [newFilter, setNewFilter] = useState('');

  const addTrack = () => {
    const label = newLabel.trim();
    if (!label) return;
    const track = createTrack(label, newColor, newFilter.trim(), tracks);
    dispatch({ type: 'track.add', track });
    setNewLabel('');
    setNewFilter('');
    setNewColor(TRACK_COLORS[(tracks.length + 1) % TRACK_COLORS.length]);
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-micro uppercase tracking-wide text-muted">Tracks</span>
        <button
          onClick={() => setAdding(!adding)}
          className="text-muted hover:text-parchment"
          aria-label="Add track"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Track list */}
      {tracks.length > 0 && (
        <div className="flex flex-col gap-1">
          {tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-rule"
                style={{ backgroundColor: t.color }}
              />
              <span className={`text-xs flex-1 truncate ${t.visible === false ? 'text-muted line-through' : 'text-parchment/80'}`}>
                {t.label}
              </span>
              <button
                onClick={() => dispatch({ type: 'track.update', id: t.id, patch: { visible: t.visible === false } })}
                className="text-muted hover:text-parchment"
                aria-label={t.visible === false ? 'Show track' : 'Hide track'}
              >
                {t.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button
                onClick={() => dispatch({ type: 'track.remove', id: t.id })}
                className="text-muted hover:text-red-400"
                aria-label="Remove track"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="flex flex-col gap-1.5 border border-rule rounded p-2 bg-ink/20">
          <input
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTrack(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Track label"
            className="text-xs border border-rule rounded px-1.5 py-0.5 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none"
          />
          <div className="flex gap-1">
            {TRACK_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-4 h-4 rounded-full border-2 ${newColor === c ? 'border-parchment' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <input
            value={newFilter}
            onChange={(e) => setNewFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTrack(); }}
            placeholder='Filter (e.g. kind == "person")'
            className="text-xs border border-rule rounded px-1.5 py-0.5 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none"
          />
          <div className="flex gap-1">
            <button
              onClick={() => setAdding(false)}
              className="flex-1 text-micro border border-rule rounded px-1 py-0.5 text-muted hover:text-parchment"
            >
              Cancel
            </button>
            <button
              onClick={addTrack}
              disabled={!newLabel.trim()}
              className="flex-1 text-micro bg-brass/20 border border-brass/50 rounded px-1 py-0.5 text-brass hover:bg-brass/30 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
