import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import {
    buildContainmentTree, computeLODLevel, cullNodes,
    getEdgeColor, getNodeShape, assignTracks, computeGaps,
    timeTicks, formatYear, getKindFill,
} from '../utils/timelineUtils.js';

const LANE_HEIGHT = 60;
const AXIS_HEIGHT = 30;
const PADDING = { top: 20, right: 40, bottom: AXIS_HEIGHT + 10, left: 40 };

export default function TimelineCanvas({ doc, height = 600 }) {
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

    useEffect(() => {
        if (!svgRef.current || !doc.nodes.length) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = svgRef.current.clientWidth || 800;
        const [yearStart, yearEnd] = doc.meta.yearRange;

        const xScale = d3.scaleLinear()
        .domain([yearStart, yearEnd])
        .range([PADDING.left, width - PADDING.right]);

        // Clip path
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
        .attr('rx', 4);

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

            nodeGroup.selectAll('.node')
            .data(visibleNodes, (d) => d.id)
            .join('g')
            .attr('class', 'node')
            .each(function (d) {
                const el = d3.select(this);
                el.selectAll('*').remove();

                const trackIdx = trackAssignment.get(d.id) || 0;
                const y = PADDING.top + trackIdx * LANE_HEIGHT + LANE_HEIGHT / 2;
                const t = d.time?.derived;
                if (!t) return;

                const shape = getNodeShape(d);

                if (shape.type === 'circle') {
                    const x = xScale(t.start);
                    el.append('circle')
                    .attr('cx', x).attr('cy', y)
                    .attr('r', shape.r || 6)
                    .attr('fill', getKindFill(d.kind))
                    .attr('stroke', shape.dashed ? '#9ca3af' : '#374151')
                    .attr('stroke-width', shape.doubleStroke ? 2.5 : 1)
                    .attr('stroke-dasharray', shape.dashed ? '3,2' : null);
                } else if (shape.type === 'rect') {
                    const x1 = xScale(t.start);
                    const x2 = t.end != null ? xScale(t.end) : x1 + (shape.w || 8);
                    const w = Math.max(4, x2 - x1);
                    el.append('rect')
                    .attr('x', x1).attr('y', y - (shape.h || 14) / 2)
                    .attr('width', w).attr('height', shape.h || 14)
                    .attr('fill', getKindFill(d.kind))
                    .attr('opacity', shape.opacity || 0.8)
                    .attr('stroke', '#374151')
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', shape.dashed ? '4,2' : null)
                    .attr('rx', 3);
                } else if (shape.type === 'diamond') {
                    const x = xScale(t.start);
                    const r = shape.r || 7;
                    el.append('rect')
                    .attr('x', x - r).attr('y', y - r)
                    .attr('width', r * 2).attr('height', r * 2)
                    .attr('transform', `rotate(45,${x},${y})`)
                    .attr('fill', getKindFill(d.kind))
                    .attr('stroke', '#374151')
                    .attr('stroke-width', 1);
                }

                if (showLabels) {
                    const labelX = shape.type === 'rect'
                    ? xScale(t.start) + 4
                    : xScale(t.start) + (shape.r || 6) + 4;
                    el.append('text')
                    .attr('x', labelX).attr('y', y + 4)
                    .attr('font-size', '10px')
                    .attr('fill', '#374151')
                    .text(d.label);
                }

                el.append('title').text(d.label);
            });
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
            .attr('opacity', 0.7);

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
            .attr('stroke', '#d1d5db').attr('stroke-width', 1);

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
                .attr('stroke', '#9ca3af');
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
    }, [doc, containmentTree, trackAssignment, sortedNodes, gaps, height]);

    return (
        <svg
        ref={svgRef}
        className="w-full select-none"
        style={{ height }}
        role="img"
        aria-label={`Timeline: ${doc.meta.title}`}
        />
    );
}
