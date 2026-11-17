import { useState } from 'react';
import { X } from 'lucide-react';

const EDGE_KIND_GROUPS = {
  temporal: ['causes', 'precedes', 'concurrent', 'contains', 'synchronizes'],
  narrative: ['responds', 'prophesies', 'fulfills', 'types', 'escalates', 'contrasts', 'covenants'],
  relational: ['father_of', 'teacher_of', 'succeeds', 'rival_of', 'allied_with', 'vassal_of', 'located_in', 'governs'],
  structural: ['part_of', 'echoes', 'references'],
};

const EDGE_CONFIDENCE = ['certain', 'probable', 'traditional', 'speculative'];

export default function EdgeCreateDialog({ fromLabel, toLabel, onConfirm, onCancel }) {
  const [kind, setKind] = useState('precedes');
  const [confidence, setConfidence] = useState('probable');
  const [color, setColor] = useState('');
  const [subtype, setSubtype] = useState('');

  const confirm = () => {
    onConfirm({ kind, confidence, color: color || undefined, subtype: subtype || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-panel border border-rule rounded shadow-lg w-72 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-parchment">New Edge</span>
          <button onClick={onCancel} className="text-muted hover:text-parchment" aria-label="Cancel">
            <X size={14} />
          </button>
        </div>

        <div className="text-micro text-muted">
          {fromLabel} → {toLabel}
        </div>

        <label className="flex flex-col gap-0.5">
          <span className="text-micro uppercase tracking-wide text-muted">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="text-xs border border-rule rounded px-1.5 py-1 bg-ink text-parchment focus:border-brass focus:outline-none"
          >
            {Object.entries(EDGE_KIND_GROUPS).map(([group, kinds]) => (
              <optgroup key={group} label={group}>
                {kinds.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-0.5">
          <span className="text-micro uppercase tracking-wide text-muted">Confidence</span>
          <select
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            className="text-xs border border-rule rounded px-1.5 py-1 bg-ink text-parchment focus:border-brass focus:outline-none"
          >
            {EDGE_CONFIDENCE.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-0.5">
          <span className="text-micro uppercase tracking-wide text-muted">Color (optional)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={color || '#000000'}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 rounded border border-rule cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#hex"
              className="text-xs border border-rule rounded px-1.5 py-0.5 flex-1 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none"
            />
          </div>
        </label>

        <label className="flex flex-col gap-0.5">
          <span className="text-micro uppercase tracking-wide text-muted">Subtype (optional)</span>
          <input
            type="text"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            placeholder="e.g. miracle"
            className="text-xs border border-rule rounded px-1.5 py-0.5 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none"
          />
        </label>

        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancel}
            className="flex-1 text-xs border border-rule rounded px-2 py-1 text-muted hover:text-parchment hover:border-parchment/40"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className="flex-1 text-xs bg-brass/20 border border-brass/50 rounded px-2 py-1 text-brass hover:bg-brass/30"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
