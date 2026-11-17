import { getKindFill } from '../utils/timelineUtils.js';

const KINDS = [
    { kind: 'event', label: 'Event' },
{ kind: 'span', label: 'Span' },
{ kind: 'person', label: 'Person' },
{ kind: 'place', label: 'Place' },
{ kind: 'covenant', label: 'Covenant' },
{ kind: 'book', label: 'Book' },
{ kind: 'political', label: 'Political' },
{ kind: 'theme', label: 'Theme' },
{ kind: 'period', label: 'Period' },
];

export default function NodePalette({ onCreate, vertical = false }) {
    const handleDragStart = (e, kind) => {
        e.dataTransfer.setData('application/x-node-kind', kind);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className={`flex ${vertical ? 'flex-col' : 'flex-row'} gap-1 ${vertical ? '' : 'px-3 py-1.5 border-b border-rule bg-panel overflow-x-auto'}`}>
        {!vertical && <span className="text-micro text-muted mr-1 shrink-0">+ Node</span>}
        {KINDS.map(({ kind, label }) => (
            <button
            key={kind}
            draggable
            onDragStart={(e) => handleDragStart(e, kind)}
            onClick={() => onCreate(kind, null)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-micro border border-rule bg-ink/30 text-parchment/80 hover:border-brass hover:text-parchment cursor-grab active:cursor-grabbing ${vertical ? 'w-full' : 'shrink-0'}`}
            title="Click to add at center, or drag onto canvas"
            >
            <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: getKindFill(kind) }}
            />
            {label}
            </button>
        ))}
        </div>
    );
}
