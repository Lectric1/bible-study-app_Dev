import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function NodeMinimenu({ position, nodes, onSelect, onClose }) {
    const ref = useRef(null);

    useEffect(() => {
        function handleOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        }
        function handleEsc(e) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('pointerdown', handleOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('pointerdown', handleOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    if (!nodes?.length) return null;

    return (
        <div
        ref={ref}
        className="fixed z-50 bg-panel border border-rule rounded shadow-lg py-1 min-w-[160px]"
        style={{ left: position.x, top: position.y + 28 }}
        >
        {nodes.map((n) => (
            <button
            key={n.id}
            className="block w-full text-left px-3 py-2 text-xs text-parchment/80 hover:bg-ink/40"
            onClick={() => { onSelect(n); onClose(); }}
            >
            {n.label}
            <span className="ml-2 text-micro text-muted">{n.kind}</span>
            </button>
        ))}
        </div>
    );
}
