import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import {
    buildContainmentTree, computeLODLevel, cullNodes,
    getEdgeColor, assignTracks, computeGaps,
    timeTicks, formatYear, getKindFill,
} from '../utils/timelineUtils.js';
import { getIconElements } from '../utils/lucideSvg.js';
import 'd3-transition';
import NodeMinimenu from './NodeMinimenu';


const LANE_HEIGHT = 60;
const AXIS_HEIGHT = 30;
const PADDING = { top: 20, right: 40, bottom: AXIS_HEIGHT + 10, left: 40 };

export default function TimelineCanvas({
    doc,
    height = 600,
    onClusterTap = () => {},
    onSelectNode = () => {},
    onSelectEdge = () => {},
    onCreateNode = () => {},
    onCreateEdge = () => {},
    selectedNodeId = null,
}) {
    const svgRef = useRef(null);

    const containmentTree = useMemo(
        () => buildContainmentTree(doc.nodes, doc.edges),
                                    [doc]
    );
    const trackAssignment = useMemo(
        () => assignTracks(doc.nodes, doc.display),
                                    [doc]
    );
    const sortedNodes = useMemo(
        () =>
        [...doc.nodes]
        .filter((n) => n.time?.derived?.start != null)
        .sort((a, b) => a.time.derived.start - b.time.derived.start),
                                [doc]
    );
    const gaps = useMemo(() => computeGaps(sortedNodes), [sortedNodes]);

    const LINE_STYLES = {
        person:    { width: 2, opacity: 1,   dash: null },
        span:      { width: 4, opacity: 1,   dash: null },
        covenant:  { width: 3, opacity: 1,   dash: '6,3' },
        political: { width: 3, opacity: 1,   dash: null },
        period:    { width: 6, opacity: 0.4, dash: null },
    };

    const ICON_KINDS = new Set(['event', 'place', 'book', 'theme']);
    const MONTH_IN_YEARS = 1 / 12;
    const ICON_MAP = {
        event: 'Zap',
        place: 'MapPin',
        book: 'BookOpen',
        theme: 'Sparkles',
    };

    useEffect(() => {
        if (!svgRef.current || !doc.nodes.length) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = svgRef.current.clientWidth || 800;
        const [yearStart, yearEnd] = doc.meta.yearRange;

        const xScale = d3.scaleLinear()
        .domain([yearStart, yearEnd])
        .range([PADDING.left, width - PADDING.right]);

        svg.append('defs').append('clipPath')
        .attr('id', 'timeline-clip')
        .append('rect')
        .attr('x', PADDING.left)
        .attr('y', 0)
        .attr('width', width - PADDING.left - PADDING.right)
        .attr('height', height);

        const g = svg.append('g').attr('clip-path', 'url(#timeline-clip)');

        // ─── Track lanes ─────────────────────────────────────────────────
        const tracks = doc.display?.tracks || [];
        const allTracks = [
            ...tracks.map((t, i) => ({ id: t.id, label: t.label, color: t.color, index: i })),
              { id: '__default', label: '', color: '#f3f4f6', index: tracks.length },
        ];

        g.selectAll('.track-lane')
        .data(allTracks)
        .join('rect')
        .attr('class', 'track-lane')
        .attr('x', PADDING.left)
        .attr('y', (d) => PADDING.top + d.index * LANE_HEIGHT)
        .attr('width', width - PADDING.left - PADDING.right)
        .attr('height', LANE_HEIGHT)
        .attr('fill', (d) => d.color + '22')
        .attr('stroke', (d) => d.color)
        .attr('stroke-width', 0.5)
        .attr('rx', 4)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'crispEdges');

        g.selectAll('.track-label')
        .data(allTracks.filter((t) => t.label))
        .join('text')
        .attr('class', 'track-label')
        .attr('x', PADDING.left + 8)
        .attr('y', (d) => PADDING.top + d.index * LANE_HEIGHT + 14)
        .attr('font-size', '11px')
        .attr('fill', '#6b7280')
        .text((d) => d.label);

        // ─── Render functions ────────────────────────────────────────────
        const nodeGroup = g.append('g').attr('class', 'nodes');
        const edgeGroup = g.append('g').attr('class', 'edges');
        const gapGroup = g.append('g').attr('class', 'gaps');
        const axisGroup = svg.append('g').attr('class', 'time-axis');

        const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));

        function renderNodes(ppy) {
            const visibleIds = cullNodes(doc.nodes, containmentTree, ppy);
            const lod = computeLODLevel(ppy);
            const showLabels = lod === 'near' || lod === 'close';
            const visibleNodes = doc.nodes.filter((n) => visibleIds.has(n.id));

            // Compute per-track y offsets
            const trackNodes = new Map();
            for (const n of visibleNodes) {
                if (n.time?.derived?.start == null) continue;
                const idx = trackAssignment.get(n.id) || 0;
                if (!trackNodes.has(idx)) trackNodes.set(idx, []);
                trackNodes.get(idx).push(n);
            }

            const KIND_ORDER = { period: 0, political: 1, span: 2, covenant: 3, person: 4, event: 5, book: 5, theme: 5, place: 5 };
            const MIN_ICON_SPACING = 30;
            const yPositions = new Map();

            for (const [trackIdx, nodes] of trackNodes) {
                const laneTop = PADDING.top + trackIdx * LANE_HEIGHT;
                const laneCenter = laneTop + LANE_HEIGHT / 2;
                const spacing = 14;

                const lineNodes = nodes.filter((n) => !ICON_KINDS.has(n.kind));
                const iconNodes = nodes.filter((n) => ICON_KINDS.has(n.kind));

                lineNodes.sort((a, b) => (KIND_ORDER[a.kind] ?? 5) - (KIND_ORDER[b.kind] ?? 5));
                const lineStart = laneCenter - ((lineNodes.length - 1) * spacing) / 2;
                lineNodes.forEach((n, i) => {
                    yPositions.set(n.id, lineStart + i * spacing);
                });

                iconNodes.sort((a, b) => {
                    const xa = xScale(a.time.derived.start);
                    const xb = xScale(b.time.derived.start);
                    return xa - xb;
                });

                const rows = [];
                for (const n of iconNodes) {
                    const x = xScale(n.time.derived.start);
                    const placed = rows.some((row) =>
                    row.every((r) => Math.abs(xScale(r.time.derived.start) - x) >= MIN_ICON_SPACING)
                    );
                    if (placed) {
                        rows.find((row) =>
                        row.every((r) => Math.abs(xScale(r.time.derived.start) - x) >= MIN_ICON_SPACING)
                        ).push(n);
                    } else {
                        rows.push([n]);
                    }
                }

                const iconStart = laneCenter - ((rows.length - 1) * spacing) / 2;
                rows.forEach((row, i) => {
                    row.forEach((n) => yPositions.set(n.id, iconStart + i * spacing));
                });
            }

            // ── Cluster detection: group icon nodes whose hit-circles overlap ──
            const CLUSTER_RADIUS = 22;
            const iconNodeList = [];
            for (const n of visibleNodes) {
                if (!ICON_KINDS.has(n.kind) || n.time?.derived?.start == null) continue;
                const x = xScale(n.time.derived.start);
                const y = yPositions.get(n.id) ?? 0;
                iconNodeList.push({ id: n.id, x, y });
            }

            const clusters = [];
            const assigned = new Set();

            for (const node of iconNodeList) {
                if (assigned.has(node.id)) continue;
                const cluster = [node];
                assigned.add(node.id);

                for (const other of iconNodeList) {
                    if (assigned.has(other.id)) continue;
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_RADIUS * 2) {
                        cluster.push(other);
                        assigned.add(other.id);
                    }
                }

                if (cluster.length > 1) {
                    const cx = cluster.reduce((s, n) => s + n.x, 0) / cluster.length;
                    const cy = cluster.reduce((s, n) => s + n.y, 0) / cluster.length;
                    clusters.push({ nodes: cluster, cx, cy });
                }
            }

            const clusteredIds = new Set();
            clusters.forEach((c) => c.nodes.forEach((n) => clusteredIds.add(n.id)));


            nodeGroup.selectAll('.node')
            .data(visibleNodes, (d) => d.id)
            .join('g')
            .attr('class', 'node')
            .each(function (d) {
                const el = d3.select(this);
                el.selectAll('*').remove();

                const trackIdx = trackAssignment.get(d.id) || 0;
                const y = yPositions.get(d.id) ?? (PADDING.top + trackIdx * LANE_HEIGHT + LANE_HEIGHT / 2);
                const t = d.time?.derived;
                if (!t) return;

                const x1 = xScale(t.start);
                const x2 = t.end != null ? xScale(t.end) : null;
                const fill = getKindFill(d.kind);

                // ── Line kinds ──
                if (LINE_STYLES[d.kind]) {
                    const style = LINE_STYLES[d.kind];
                    if (x2 != null && x2 > x1) {
                        el.append('line')
                        .attr('x1', x1).attr('y1', y)
                        .attr('x2', x2).attr('y2', y)
                        .attr('stroke', fill)
                        .attr('stroke-width', style.width)
                        .attr('opacity', style.opacity)
                        .attr('stroke-dasharray', style.dash)
                        .attr('stroke-linecap', 'round')
                        .attr('vector-effect', 'non-scaling-stroke')
                        .attr('shape-rendering', 'crispEdges');
                    } else {
                        el.append('circle')
                        .attr('cx', x1).attr('cy', y).attr('r', 3)
                        .attr('fill', fill)
                        .attr('opacity', style.opacity)
                        .attr('shape-rendering', 'geometricPrecision');
                    }

                    // Hit area for line kinds
                    const lineEnd = x2 != null && x2 > x1 ? x2 : x1 + 12;
                    el.append('rect')
                    .attr('class', 'node-hitarea')
                    .attr('x', x1 - 6).attr('y', y - 6)
                    .attr('width', Math.max(44, lineEnd - x1 + 12))
                    .attr('height', 12)
                    .attr('fill', 'transparent')
                    .attr('stroke', 'none')
                    .on('click', (event) => {
                        event.stopPropagation();
                        onSelectNode(d.id);
                    });
                }

                // ── Icon kinds ──
                if (ICON_KINDS.has(d.kind)) {
                    if (t.end != null && (t.end - t.start) > MONTH_IN_YEARS) {
                        el.append('line')
                        .attr('x1', x1).attr('y1', y)
                        .attr('x2', x2).attr('y2', y)
                        .attr('stroke', fill)
                        .attr('stroke-width', 2)
                        .attr('opacity', 0.6)
                        .attr('stroke-linecap', 'round')
                        .attr('vector-effect', 'non-scaling-stroke')
                        .attr('shape-rendering', 'crispEdges');
                    }

                    const iconName = ICON_MAP[d.kind];
                    const iconSize = Math.max(12, Math.min(28, ppy * 0.8));
                    const half = iconSize / 2;

                    const iconG = el.append('g')
                    .attr('class', 'node-icon')
                    .attr('transform', `translate(${x1 - half},${y - half}) scale(${iconSize / 24})`);

                    const elements = getIconElements(iconName);
                    elements.forEach((child) => {
                        const node = iconG.node().appendChild(child);
                        node.setAttribute('vector-effect', 'non-scaling-stroke');
                        node.setAttribute('stroke', fill);
                        node.setAttribute('fill', 'none');
                    });

                    // ── Edge creation handle (on selected node) ──
                    if (d.id === selectedNodeId) {
                        const handleX = x1 + 18;
                        const handleY = y;
                        el.append('circle')
                        .attr('class', 'edge-handle')
                        .attr('cx', handleX)
                        .attr('cy', handleY)
                        .attr('r', 7)
                        .attr('fill', '#7c3aed')
                        .attr('opacity', 0.8)
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 1.5)
                        .style('cursor', 'crosshair')
                        .on('pointerdown', (event) => onHandlePointerDown(event, d.id));
                        el.append('title').text('Drag to create edge');
                    }


                    // Hit area + interaction for icons
                    if (!clusteredIds.has(d.id)) {
                        const baseTransform = `translate(${x1 - half},${y - half}) scale(${iconSize / 24})`;
                        const activeTransform = `translate(${x1 - half * 1.5},${y - half * 1.5}) scale(${iconSize / 24 * 1.5})`;

                        el.append('circle')
                        .attr('class', 'node-hitarea')
                        .attr('cx', x1).attr('cy', y)
                        .attr('r', 22)
                        .attr('fill', 'transparent')
                        .attr('stroke', 'none')
                        .on('pointerdown', function (event) {
                            event.stopPropagation();
                            iconG.transition().duration(150).attr('transform', activeTransform);
                        })
                        .on('pointerup', function () {
                            iconG.transition().duration(150).attr('transform', baseTransform);
                            onSelectNode(d.id);
                        })
                        .on('pointerleave', function () {
                            iconG.transition().duration(150).attr('transform', baseTransform);
                        });
                    }
                }

                // ── Label ──
                if (showLabels) {
                    const labelX = (x2 != null && x2 > x1) ? x2 + 6 : x1 + 8;
                    el.append('text')
                    .attr('x', labelX).attr('y', y + 4)
                    .attr('font-size', '10px')
                    .attr('fill', '#374151')
                    .text(d.label);
                }

                el.append('title').text(d.label);
            });
            // ── Shared cluster hit circles ──
            nodeGroup.selectAll('.cluster-hit')
            .data(clusters, (d, i) => i)
            .join('circle')
            .attr('class', 'cluster-hit node-hitarea')
            .attr('cx', (d) => d.cx)
            .attr('cy', (d) => d.cy)
            .attr('r', 22)
            .attr('fill', 'transparent')
            .attr('stroke', 'none')
            .on('pointerdown', function (event) {
                event.stopPropagation();
                const d = d3.select(this).datum();
                const svgRect = svgRef.current.getBoundingClientRect();
                const t = d3.zoomTransform(svgRef.current);
                const screenX = t.applyX(d.cx);
                const screenY = t.applyY(d.cy);
                onClusterTap({
                    x: svgRect.left + screenX,
                    y: svgRect.top + screenY,
                    nodes: d.nodes.map((n) => nodeMap.get(n.id)),
                });
            });
        }
        // ─── Edge drag-to-create ──────────────────────────────────────────────────
        const dragPath = g.append('path')
        .attr('class', 'edge-drag-preview')
        .attr('fill', 'none')
        .attr('stroke', '#7c3aed')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,3')
        .attr('opacity', 0)
        .attr('vector-effect', 'non-scaling-stroke');

        let dragging = false;
        let dragSourceId = null;
        let dragSourcePos = null;

        function getNodeCenter(nodeId) {
            const node = nodeMap.get(nodeId);
            if (!node?.time?.derived) return null;
            const x = xScale(node.time.derived.start);
            const trackIdx = trackAssignment.get(nodeId) || 0;
            const y = PADDING.top + trackIdx * LANE_HEIGHT + LANE_HEIGHT / 2;
            return { x, y };
        }

        function findNodeAtPoint(svgX, svgY) {
            for (const n of doc.nodes) {
                if (!n.time?.derived) continue;
                const pos = getNodeCenter(n.id);
                if (!pos) continue;
                const dx = svgX - pos.x;
                const dy = svgY - pos.y;
                if (Math.sqrt(dx * dx + dy * dy) < 24) return n.id;
            }
            return null;
        }

        function onHandlePointerDown(event, sourceId) {
            event.stopPropagation();
            event.preventDefault();
            dragging = true;
            dragSourceId = sourceId;
            dragSourcePos = getNodeCenter(sourceId);
            dragPath.attr('opacity', 1);

            const onMove = (e) => {
                if (!dragging) return;
                const svgRect = svgRef.current.getBoundingClientRect();
                const t = d3.zoomTransform(svgRef.current);
                const svgX = t.invertX(e.clientX - svgRect.left);
                const svgY = t.invertY(e.clientY - svgRect.top);
                const sx = dragSourcePos.x;
                const sy = dragSourcePos.y;
                const mx = (sx + svgX) / 2;
                dragPath.attr('d', `M${sx},${sy} C${mx},${sy} ${mx},${svgY} ${svgX},${svgY}`);
            };

            const onUp = (e) => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                dragging = false;
                dragPath.attr('opacity', 0).attr('d', '');

                const svgRect = svgRef.current.getBoundingClientRect();
                const t = d3.zoomTransform(svgRef.current);
                const svgX = t.invertX(e.clientX - svgRect.left);
                const svgY = t.invertY(e.clientY - svgRect.top);
                const targetId = findNodeAtPoint(svgX, svgY);
                if (targetId && targetId !== dragSourceId) {
                    onCreateEdge(dragSourceId, targetId);
                }
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        }


        function renderEdges(ppy, visibleIds) {
            const lod = computeLODLevel(ppy);
            if (lod !== 'near' && lod !== 'close') {
                edgeGroup.selectAll('*').remove();
                return;
            }

            const visibleEdges = doc.edges.filter(
                (e) => visibleIds.has(e.from) && visibleIds.has(e.to)
            );

            const edgeSel = edgeGroup.selectAll('.edge')
            .data(visibleEdges, (d) => d.id)
            .join('g')
            .attr('class', 'edge');

            // ── Visible edge path ──
            edgeSel.append('path')
            .attr('d', (d) => {
                const from = nodeMap.get(d.from);
                const to = nodeMap.get(d.to);
                if (!from?.time?.derived || !to?.time?.derived) return '';
                const x1 = xScale(from.time.derived.start);
                const x2 = xScale(to.time.derived.start);
                const y1 = PADDING.top + (trackAssignment.get(d.from) || 0) * LANE_HEIGHT + LANE_HEIGHT / 2;
                const y2 = PADDING.top + (trackAssignment.get(d.to) || 0) * LANE_HEIGHT + LANE_HEIGHT / 2;
                const mx = (x1 + x2) / 2;
                return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
            })
            .attr('fill', 'none')
            .attr('stroke', (d) => getEdgeColor(d))
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.7)
            .attr('vector-effect', 'non-scaling-stroke')
            .attr('shape-rendering', 'geometricPrecision');

            // ── Edge hit area (12px transparent) ──
            edgeSel.append('path')
            .attr('d', (d) => {
                const from = nodeMap.get(d.from);
                const to = nodeMap.get(d.to);
                if (!from?.time?.derived || !to?.time?.derived) return '';
                const x1 = xScale(from.time.derived.start);
                const x2 = xScale(to.time.derived.start);
                const y1 = PADDING.top + (trackAssignment.get(d.from) || 0) * LANE_HEIGHT + LANE_HEIGHT / 2;
                const y2 = PADDING.top + (trackAssignment.get(d.to) || 0) * LANE_HEIGHT + LANE_HEIGHT / 2;
                const mx = (x1 + x2) / 2;
                return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
            })
            .attr('fill', 'none')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 12)
            .attr('class', 'edge-hitarea')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                onSelectEdge(d.id);
            });

            edgeSel.append('title')
            .text((d) => {
                const from = nodeMap.get(d.from)?.label || d.from;
                const to = nodeMap.get(d.to)?.label || d.to;
                return `${from} → ${to} (${d.kind})`;
            });
        }

        function renderGaps(ppy, visibleIds) {
            const lod = computeLODLevel(ppy);
            if (lod !== 'near' && lod !== 'close') {
                gapGroup.selectAll('*').remove();
                return;
            }

            const visibleGaps = gaps.filter(
                (gap) => visibleIds.has(gap.fromId) && visibleIds.has(gap.toId)
            );

            gapGroup.selectAll('.gap-label')
            .data(visibleGaps, (d) => d.fromId + d.toId)
            .join('text')
            .attr('class', 'gap-label')
            .attr('x', (d) => {
                const a = nodeMap.get(d.fromId);
                const b = nodeMap.get(d.toId);
                const x1 = xScale(a.time.derived.end ?? a.time.derived.start);
                const x2 = xScale(b.time.derived.start);
                return (x1 + x2) / 2;
            })
            .attr('y', PADDING.top + 12)
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('fill', '#9ca3af')
            .text((d) => `+${d.gapYears} yr`);
        }

        function renderAxis(scale) {
            axisGroup.selectAll('*').remove();
            const ticks = timeTicks(scale.domain()[0], scale.domain()[1]);
            const axisY = height - PADDING.bottom + 10;

            axisGroup.append('line')
            .attr('x1', PADDING.left).attr('x2', width - PADDING.right)
            .attr('y1', axisY).attr('y2', axisY)
            .attr('stroke', '#d1d5db').attr('stroke-width', 1)
            .attr('vector-effect', 'non-scaling-stroke')
            .attr('shape-rendering', 'crispEdges');

            axisGroup.selectAll('.tick')
            .data(ticks)
            .join('g')
            .attr('class', 'tick')
            .each(function (d) {
                const x = scale(d);
                if (x < PADDING.left || x > width - PADDING.right) return;
                const tickG = d3.select(this);
                tickG.append('line')
                .attr('x1', x).attr('x2', x)
                .attr('y1', axisY).attr('y2', axisY + 5)
                .attr('stroke', '#9ca3af')
                .attr('vector-effect', 'non-scaling-stroke')
                .attr('shape-rendering', 'crispEdges');
                tickG.append('text')
                .attr('x', x).attr('y', axisY + 16)
                .attr('text-anchor', 'middle')
                .attr('font-size', '10px')
                .attr('fill', '#6b7280')
                .text(formatYear(d));
            });
        }

        // ─── Zoom ────────────────────────────────────────────────────────
        let currentScale = xScale;

        function onZoom(event) {
            const t = event.transform;
            g.attr('transform', t);
            currentScale = t.rescaleX(xScale);
            const ppy = currentScale(1) - currentScale(0);
            const visibleIds = cullNodes(doc.nodes, containmentTree, ppy);
            renderNodes(ppy);
            renderEdges(ppy, visibleIds);
            renderGaps(ppy, visibleIds);
            renderAxis(currentScale);
        }

        const zoom = d3.zoom()
        .scaleExtent([0.1, 200])
        .translateExtent([[PADDING.left, 0], [width - PADDING.right, height]])
        .on('zoom', onZoom);

        svg.call(zoom);

        // ─── Drop-to-create ──────────────────────────────────────────────────────
        svg.on('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        });

        svg.on('drop', (event) => {
            event.preventDefault();
            const kind = event.dataTransfer.getData('application/x-node-kind');
            if (!kind) return;
            const svgRect = svgRef.current.getBoundingClientRect();
            const svgX = event.clientX - svgRect.left;
            const year = Math.round(currentScale.invert(svgX));
            onCreateNode(kind, year);
        });

        // Initial render
        const initialPpy = xScale(1) - xScale(0);
        const initialVisible = cullNodes(doc.nodes, containmentTree, initialPpy);
        renderNodes(initialPpy);
        renderEdges(initialPpy, initialVisible);
        renderGaps(initialPpy, initialVisible);
        renderAxis(xScale);

        return () => {
            svg.on('.zoom', null);
            svg.selectAll('*').remove();
        };
    }, [doc, containmentTree, trackAssignment, sortedNodes, gaps, height, onCreateNode, onCreateEdge, selectedNodeId]);

    return (
        <>
        <style>{`
            .node-hitarea { cursor: pointer; }
            .edge-hitarea { cursor: pointer; }
            .edge-handle { cursor: crosshair; }
            `}</style>
            <svg
            ref={svgRef}
            className="w-full select-none"
            style={{ height }}
            role="img"
            aria-label={`Timeline: ${doc.meta.title}`}
            />
            </>
    );
}
