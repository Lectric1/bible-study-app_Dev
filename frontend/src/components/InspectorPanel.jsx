import { useState, useEffect, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';

// ─── Computed field helpers ───────────────────────────────────────────────

function computeDuration(node) {
    const t = node.time?.derived;
    if (t?.start != null && t?.end != null) {
        return t.end - t.start;
    }
    return null;
}

function computeGapToNext(node, doc) {
    const t = node.time?.derived;
    if (t?.start == null) return null;
    const end = t.end ?? t.start;
    const sorted = doc.nodes
    .filter((n) => n.time?.derived?.start != null)
    .sort((a, b) => a.time.derived.start - b.time.derived.start);
    const idx = sorted.findIndex((n) => n.id === node.id);
    if (idx === -1 || idx >= sorted.length - 1) return null;
    return sorted[idx + 1].time.derived.start - end;
}

function computeYearsSinceCovenant(node, doc) {
    const t = node.time?.derived;
    if (t?.start == null) return null;
    const covenants = doc.nodes
    .filter((n) => n.kind === 'covenant' && n.time?.derived?.start != null)
    .filter((n) => n.time.derived.start <= t.start)
    .sort((a, b) => b.time.derived.start - a.time.derived.start);
    if (!covenants.length) return null;
    return { years: t.start - covenants[0].time.derived.start, covenant: covenants[0] };
}

// ─── Small field components ───────────────────────────────────────────────

function Field({ label, children, className = '' }) {
    return (
        <label className={`flex flex-col gap-0.5 ${className}`}>
        <span className="text-micro uppercase tracking-wide text-muted">{label}</span>
        {children}
        </label>
    );
}

function TextInput({ value, onChange, placeholder = '', type = 'text', className = '' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value ?? '');

    useEffect(() => {
        if (!editing) setDraft(value ?? '');
    }, [value, editing]);

        const commit = () => {
            setEditing(false);
            if (draft !== (value ?? '')) onChange(draft);
        };

            if (editing) {
                return (
                    <input
                    autoFocus
                    type={type}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
                    }}
                    className={`text-xs border border-rule rounded px-1.5 py-0.5 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none ${className}`}
                    />
                );
            }

            return (
                <input
                type={type}
                value={draft}
                placeholder={placeholder}
                onFocus={() => setEditing(true)}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
                }}
                className={`text-xs border border-rule rounded px-1.5 py-0.5 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none ${className}`}
                />
            );
}

function NumberInput({ value, onChange, placeholder = '', step = 1, className = '' }) {
    const [draft, setDraft] = useState(value != null ? String(value) : '');

    useEffect(() => {
        setDraft(value != null ? String(value) : '');
    }, [value]);

    const commit = () => {
        const num = draft === '' ? null : Number(draft);
        if (num !== value && (num === null || !isNaN(num))) onChange(num);
    };

        return (
            <input
            type="number"
            value={draft}
            placeholder={placeholder}
            step={step}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setDraft(value != null ? String(value) : '');
            }}
            className={`text-xs border border-rule rounded px-1.5 py-0.5 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none ${className}`}
            />
        );
}

function SelectInput({ value, onChange, options, className = '' }) {
    return (
        <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={`text-xs border border-rule rounded px-1.5 py-0.5 bg-ink text-parchment appearance-none cursor-pointer focus:border-brass focus:outline-none ${className}`}
        >
        <option value="" disabled>—</option>
        {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
        ))}
        </select>
    );
}

function TagInput({ value = [], onChange }) {
    const [draft, setDraft] = useState('');

    const addTag = () => {
        const t = draft.trim();
        if (t && !value.includes(t)) onChange([...value, t]);
        setDraft('');
    };

    const removeTag = (tag) => onChange(value.filter((v) => v !== tag));

    return (
        <div className="flex flex-wrap gap-1 items-center">
        {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 bg-ink/40 rounded px-1.5 py-0.5 text-micro text-parchment/80">
            {tag}
            <button onClick={() => removeTag(tag)} className="text-muted hover:text-red-400">×</button>
            </span>
        ))}
        <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
            if (e.key === 'Backspace' && !draft && value.length) removeTag(value[value.length - 1]);
        }}
        onBlur={addTag}
        placeholder="+ tag"
        className="text-micro border border-rule rounded px-1 py-0.5 w-16 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none"
        />
        </div>
    );
}

function StringArrayInput({ value = [], onChange, placeholder = 'Add entry…' }) {
    const [draft, setDraft] = useState('');

    const add = () => {
        const s = draft.trim();
        if (s) onChange([...value, s]);
        setDraft('');
    };

    const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

    return (
        <div className="flex flex-col gap-1">
        {value.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
            <span className="text-xs flex-1 text-parchment/80">{s}</span>
            <button onClick={() => remove(i)} className="text-muted hover:text-red-400 text-xs">×</button>
            </div>
        ))}
        <div className="flex gap-1">
        <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className="text-xs border border-rule rounded px-1.5 py-0.5 flex-1 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none"
        />
        </div>
        </div>
    );
}

function ColorInput({ value, onChange }) {
    return (
        <div className="flex items-center gap-1.5">
        <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded border border-rule cursor-pointer"
        />
        <TextInput value={value} onChange={onChange} placeholder="#hex" className="w-20" />
        </div>
    );
}

// ─── Section wrapper ──────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-rule/50 pb-2 mb-2 last:border-0 last:mb-0">
        <button
        className="text-micro font-semibold uppercase tracking-wider text-muted hover:text-parchment w-full text-left"
        onClick={() => setOpen(!open)}
        >
        {open ? '▾' : '▸'} {title}
        </button>
        {open && <div className="mt-1.5 flex flex-col gap-2">{children}</div>}
        </div>
    );
}

// ─── Computed fields display ──────────────────────────────────────────────

function ComputedFields({ node, doc }) {
    const duration = computeDuration(node);
    const gap = computeGapToNext(node, doc);
    const covenant = computeYearsSinceCovenant(node, doc);

    const items = [];
    if (duration != null) items.push({ label: 'Duration', value: `${duration} yr` });
    if (gap != null) items.push({ label: 'Gap to next', value: `+${gap} yr` });
    if (covenant) items.push({ label: 'Since covenant', value: `${covenant.years} yr since ${covenant.covenant.label}` });

    if (!items.length) return null;

    return (
        <div className="flex gap-3 flex-wrap bg-brass/10 border border-brass/30 rounded px-2 py-1">
        {items.map((item) => (
            <span key={item.label} className="text-micro text-brass">
            <span className="text-brass/60">{item.label}:</span> {item.value}
            </span>
        ))}
        </div>
    );
}

// ─── Lock banner ──────────────────────────────────────────────────────────

function LockBanner({ locked, onToggle }) {
    if (!locked) return null;
    return (
        <div className="flex items-center gap-2 bg-brass/10 border border-brass/40 rounded px-2 py-1">
        <span className="text-micro text-brass">🔒 Locked — unlock to edit</span>
        <button
        onClick={onToggle}
        className="text-micro text-brass underline hover:text-parchment"
        >
        Unlock
        </button>
        </div>
    );
}

// ─── Node Inspector ───────────────────────────────────────────────────────

function NodeInspector({ node, doc, dispatch }) {
    const setField = useCallback((path, value) => {
        dispatch({ type: 'node.update', id: node.id, fields: path, value });
    }, [dispatch, node.id]);

    const isLocked = node.locked === true;

    const KINDS = ['event', 'span', 'person', 'place', 'covenant', 'book', 'political', 'theme', 'period'];
    const NODE_CONFIDENCE = ['scriptural', 'traditional', 'archaeological', 'inferred'];
    const TIME_CONFIDENCE = ['exact', 'approximate', 'disputed', 'undated'];
    const COVENANT_STATUS = ['active', 'fulfilled', 'superseded', 'awaiting'];
    const TRAJECTORY = ['rising', 'stable', 'declining', 'collapsed'];
    const CHRONOLOGIES = ['thiele', 'early', 'late', 'ussher', 'standard'];

    return (
        <div className="flex flex-col gap-2">
        <ComputedFields node={node} doc={doc} />
        <LockBanner locked={isLocked} onToggle={() => setField('locked', !isLocked)} />

        {/* Identity */}
        <Section title="Identity">
        <Field label="Label">
        <TextInput value={node.label} onChange={(v) => setField('label', v)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
        <Field label="Kind">
        <SelectInput value={node.kind} onChange={(v) => v && setField('kind', v)} options={KINDS} />
        </Field>
        <Field label="Subtype">
        <TextInput value={node.subtype} onChange={(v) => setField('subtype', v || undefined)} placeholder="e.g. patriarch" />
        </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
        <Field label="Confidence">
        <SelectInput value={node.confidence} onChange={(v) => setField('confidence', v)} options={NODE_CONFIDENCE} />
        </Field>
        <Field label="Display Order">
        <NumberInput value={node.displayOrder} onChange={(v) => setField('displayOrder', v)} placeholder="auto" />
        </Field>
        </div>
        </Section>

        {/* Time */}
        <Section title="Time">
        <div className="grid grid-cols-2 gap-2">
        <Field label="Start (yr)">
        <NumberInput value={node.time?.derived?.start} onChange={(v) => setField('time.derived.start', v)} placeholder="e.g. -1446" />
        </Field>
        <Field label="End (yr)">
        <NumberInput value={node.time?.derived?.end} onChange={(v) => setField('time.derived.end', v)} placeholder="e.g. -1406" />
        </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
        <Field label="Chronology">
        <SelectInput value={node.time?.derived?.chronology} onChange={(v) => setField('time.derived.chronology', v)} options={CHRONOLOGIES} />
        </Field>
        <Field label="Confidence">
        <SelectInput value={node.time?.confidence} onChange={(v) => setField('time.confidence', v)} options={TIME_CONFIDENCE} />
        </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
        <Field label="Stated Length">
        <NumberInput value={node.time?.statedLength} onChange={(v) => setField('time.statedLength', v)} placeholder="e.g. 430" />
        </Field>
        <Field label="Stated Unit">
        <SelectInput
        value={node.time?.statedUnit}
        onChange={(v) => setField('time.statedUnit', v)}
        options={['years', 'months', 'days', 'generations']}
        />
        </Field>
        </div>
        <Field label="Anchor">
        <TextInput value={node.time?.anchor} onChange={(v) => setField('time.anchor', v || undefined)} placeholder='e.g. "18th year of Josiah"' />
        </Field>

        {/* Derivation */}
        {node.time?.derivation?.steps?.length > 0 && (
            <div>
            <span className="text-micro uppercase tracking-wide text-muted">Derivation Steps</span>
            <ol className="mt-1 flex flex-col gap-0.5">
            {node.time.derivation.steps.map((step, i) => (
                <li key={i} className="text-xs text-parchment/70 flex gap-1">
                <span className="text-muted shrink-0">{i + 1}.</span>
                <span>{step}</span>
                </li>
            ))}
            </ol>
            </div>
        )}
        <Field label="Derivation Steps (add)">
        <StringArrayInput
        value={node.time?.derivation?.steps || []}
        onChange={(v) => setField('time.derivation.steps', v)}
        placeholder="Add derivation step…"
        />
        </Field>
        <Field label="Derivation Sources">
        <StringArrayInput
        value={node.time?.derivation?.sources || []}
        onChange={(v) => setField('time.derivation.sources', v)}
        placeholder="e.g. 1 Kgs 6:1"
        />
        </Field>

        {/* Alternatives */}
        {node.time?.alternatives?.length > 0 && (
            <div>
            <span className="text-micro uppercase tracking-wide text-muted">Alternatives</span>
            <div className="mt-1 flex flex-col gap-1">
            {node.time.alternatives.map((alt, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                <NumberInput
                value={alt.year}
                onChange={(v) => {
                    const next = [...node.time.alternatives];
                    next[i] = { ...next[i], year: v };
                    setField('time.alternatives', next);
                }}
                className="w-16"
                />
                <SelectInput
                value={alt.chronology}
                onChange={(v) => {
                    const next = [...node.time.alternatives];
                    next[i] = { ...next[i], chronology: v };
                    setField('time.alternatives', next);
                }}
                options={CHRONOLOGIES}
                className="w-20"
                />
                <TextInput
                value={alt.note}
                onChange={(v) => {
                    const next = [...node.time.alternatives];
                    next[i] = { ...next[i], note: v };
                    setField('time.alternatives', next);
                }}
                placeholder="note"
                className="flex-1"
                />
                <button
                onClick={() => setField('time.alternatives', node.time.alternatives.filter((_, j) => j !== i))}
                className="text-muted hover:text-red-400"
                >×</button>
                </div>
            ))}
            </div>
            </div>
        )}
        </Section>

        {/* Kind-specific */}
        {node.kind === 'person' && (
            <Section title="Person">
            <Field label="Roles">
            <TagInput value={node.roles || []} onChange={(v) => setField('roles', v)} />
            </Field>
            <Field label="Group">
            <TextInput value={node.group} onChange={(v) => setField('group', v || undefined)} placeholder="e.g. tribe of Judah" />
            </Field>
            </Section>
        )}

        {node.kind === 'place' && (
            <Section title="Place">
            <Field label="Modern Name">
            <TextInput value={node.modernName} onChange={(v) => setField('modernName', v || undefined)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
            <Field label="Lat">
            <NumberInput value={node.coords?.[0]} onChange={(v) => setField('coords', v != null ? [v, node.coords?.[1] ?? null] : null)} step={0.01} />
            </Field>
            <Field label="Lng">
            <NumberInput value={node.coords?.[1]} onChange={(v) => setField('coords', v != null ? [node.coords?.[0] ?? null, v] : null)} step={0.01} />
            </Field>
            </div>
            <Field label="Site Candidates">
            <StringArrayInput value={node.siteCandidates || []} onChange={(v) => setField('siteCandidates', v)} placeholder="Alternate hypothesis…" />
            </Field>
            </Section>
        )}

        {node.kind === 'covenant' && (
            <Section title="Covenant">
            <Field label="Status">
            <SelectInput value={node.status} onChange={(v) => setField('status', v)} options={COVENANT_STATUS} />
            </Field>
            <Field label="Promise">
            <TextInput value={node.terms?.promise} onChange={(v) => setField('terms.promise', v || undefined)} />
            </Field>
            <Field label="Condition">
            <TextInput value={node.terms?.condition} onChange={(v) => setField('terms.condition', v || undefined)} />
            </Field>
            <Field label="Sign">
            <TextInput value={node.terms?.sign} onChange={(v) => setField('terms.sign', v || undefined)} />
            </Field>
            </Section>
        )}

        {node.kind === 'book' && (
            <Section title="Book">
            <div className="grid grid-cols-2 gap-2">
            <Field label="Author">
            <TextInput value={node.author?.name} onChange={(v) => setField('author.name', v || undefined)} />
            </Field>
            <Field label="Author Disputed?">
            <select
            value={node.author?.disputed ? 'yes' : 'no'}
            onChange={(e) => setField('author.disputed', e.target.value === 'yes')}
            className="text-xs border border-rule rounded px-1.5 py-0.5 bg-ink text-parchment appearance-none cursor-pointer focus:border-brass focus:outline-none"
            >
            <option value="no">No</option>
            <option value="yes">Yes</option>
            </select>
            </Field>
            </div>
            <Field label="Genre">
            <TextInput value={node.genre} onChange={(v) => setField('genre', v || undefined)} placeholder="e.g. narrative, prophecy" />
            </Field>
            <Field label="Events Described">
            <TextInput value={node.eventsDescribed} onChange={(v) => setField('eventsDescribed', v || undefined)} placeholder="e.g. -1446 to -1406" />
            </Field>
            </Section>
        )}

        {node.kind === 'political' && (
            <Section title="Political">
            <Field label="Trajectory">
            <SelectInput value={node.trajectory} onChange={(v) => setField('trajectory', v)} options={TRAJECTORY} />
            </Field>
            <Field label="Group">
            <TextInput value={node.group} onChange={(v) => setField('group', v || undefined)} placeholder="e.g. israel, judah, world" />
            </Field>
            </Section>
        )}

        {/* Tags */}
        <Section title="Tags">
        <TagInput value={node.tags || []} onChange={(v) => setField('tags', v)} />
        </Section>

        {/* Source */}
        <Section title="Source">
        <StringArrayInput
        value={node.source || []}
        onChange={(v) => setField('source', v)}
        placeholder="e.g. Ex 12:41"
        />
        </Section>

        {/* Image & Ref */}
        <Section title="Image & Reference" defaultOpen={false}>
        <Field label="Image URL">
        <TextInput value={node.image} onChange={(v) => setField('image', v || undefined)} placeholder="https://…" />
        </Field>
        <Field label="Cross-timeline Ref">
        <TextInput value={node.ref} onChange={(v) => setField('ref', v || undefined)} placeholder="e.g. nt-timeline:evt-cross" />
        </Field>
        </Section>

        {/* Note */}
        <Section title="Note">
        <textarea
        value={node.note || ''}
        onChange={(e) => setField('note', e.target.value || undefined)}
        rows={2}
        placeholder="Free-text annotation…"
        className="text-xs border border-rule rounded px-1.5 py-1 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none resize-y w-full"
        />
        </Section>
        </div>
    );
}

// ─── Edge Inspector ───────────────────────────────────────────────────────

const EDGE_KINDS = [
    'causes', 'precedes', 'concurrent', 'contains', 'synchronizes',
'responds', 'prophesies', 'fulfills', 'types', 'escalates', 'contrasts', 'covenants',
'father_of', 'teacher_of', 'succeeds', 'rival_of', 'allied_with',
'vassal_of', 'located_in', 'governs',
'part_of', 'echoes', 'references',
];

const EDGE_CONFIDENCE = ['certain', 'probable', 'traditional', 'speculative'];

const EDGE_KIND_GROUPS = {
    temporal: ['causes', 'precedes', 'concurrent', 'contains', 'synchronizes'],
    narrative: ['responds', 'prophesies', 'fulfills', 'types', 'escalates', 'contrasts', 'covenants'],
    relational: ['father_of', 'teacher_of', 'succeeds', 'rival_of', 'allied_with', 'vassal_of', 'located_in', 'governs'],
    structural: ['part_of', 'echoes', 'references'],
};

function EdgeKindSelect({ value, onChange }) {
    return (
        <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-xs border border-rule rounded px-1.5 py-0.5 bg-ink text-parchment appearance-none cursor-pointer focus:border-brass focus:outline-none"
        >
        <option value="" disabled>—</option>
        {Object.entries(EDGE_KIND_GROUPS).map(([group, kinds]) => (
            <optgroup key={group} label={group}>
            {kinds.map((k) => (
                <option key={k} value={k}>{k}</option>
            ))}
            </optgroup>
        ))}
        </select>
    );
}

function EdgeInspector({ edge, doc, dispatch }) {
    const setField = useCallback((path, value) => {
        dispatch({ type: 'edge.update', id: edge.id, fields: path, value });
    }, [dispatch, edge.id]);

    const isLocked = edge.locked === true;

    const fromNode = doc?.nodes?.find((n) => n.id === edge.from);
    const toNode = doc?.nodes?.find((n) => n.id === edge.to);

    return (
        <div className="flex flex-col gap-2">
        <LockBanner locked={isLocked} onToggle={() => setField('locked', !isLocked)} />

        {/* Connection (read-only) */}
        <Section title="Connection">
        <div className="flex items-center gap-2 text-xs text-parchment/70">
        <span className="bg-ink/40 rounded px-1.5 py-0.5">{fromNode?.label || edge.from}</span>
        <span className="text-muted">→</span>
        <span className="bg-ink/40 rounded px-1.5 py-0.5">{toNode?.label || edge.to}</span>
        </div>
        </Section>

        {/* Identity */}
        <Section title="Identity">
        <div className="grid grid-cols-2 gap-2">
        <Field label="Kind">
        <EdgeKindSelect value={edge.kind} onChange={(v) => v && setField('kind', v)} />
        </Field>
        <Field label="Confidence">
        <SelectInput value={edge.confidence} onChange={(v) => setField('confidence', v)} options={EDGE_CONFIDENCE} />
        </Field>
        </div>
        <Field label="Subtype">
        <TextInput value={edge.subtype} onChange={(v) => setField('subtype', v || undefined)} placeholder="e.g. miracle, judgment" />
        </Field>
        </Section>

        {/* Claim */}
        <Section title="Claim" defaultOpen={!!edge.claim}>
        <textarea
        value={edge.claim || ''}
        onChange={(e) => setField('claim', e.target.value || undefined)}
        rows={2}
        placeholder='Interpretive claim (e.g. "Deliverance from Egypt prefigures deliverance from sin")'
    className="text-xs border border-rule rounded px-1.5 py-1 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none resize-y w-full"
    />
    </Section>

    {/* Color */}
    <Section title="Color">
    <ColorInput value={edge.color} onChange={(v) => setField('color', v || undefined)} />
    <p className="text-micro text-muted">
    Leave empty to use kind-based default.
    </p>
    </Section>

    {/* Source */}
    <Section title="Source">
    <StringArrayInput
    value={edge.source || []}
    onChange={(v) => setField('source', v)}
    placeholder="e.g. 2 Chr 3:1"
    />
    </Section>

    {/* Note */}
    <Section title="Note">
    <textarea
    value={edge.note || ''}
    onChange={(e) => setField('note', e.target.value || undefined)}
    rows={2}
    placeholder="Free-text annotation…"
    className="text-xs border border-rule rounded px-1.5 py-1 bg-ink/30 text-parchment placeholder:text-muted/50 focus:border-brass focus:outline-none resize-y w-full"
    />
    </Section>
    </div>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────

export default function InspectorPanel({ selection, node, edge, doc, dispatch, onClose }) {
    return (
        <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule px-4 py-1.5 shrink-0">
        <span className="text-xs font-medium text-parchment/80">
        {node ? `📌 ${node.label}` : edge ? `→ ${edge.kind} (${edge.from} → ${edge.to})` : ''}
        </span>
        <button
        className="text-muted hover:text-parchment"
        onClick={onClose}
        aria-label="Close inspector"
        >
        <X size={12} />
        </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
        {node && <NodeInspector node={node} doc={doc} dispatch={dispatch} />}
        {edge && <EdgeInspector edge={edge} doc={doc} dispatch={dispatch} />}
        </div>
        </div>
    );
}
