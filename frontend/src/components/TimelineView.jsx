/**
 * TimelineView.jsx
 * Read-only D3 SVG timeline renderer.
 * Phase 2: zoom, pan, LOD culling, node/edge rendering.
 *
 * Props:
 *   timelineId (string) — which timeline to render
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { getTimeline } from "../api/client.js";
import { buildContainmentTree, cullByContainment } from '../utils/timelineContainmentUtil.js';
// ─── LOD thresholds (pixels per year) ────────────────────────────────────────

const LOD = {
  FAR: 0.5,       // below this: periods only
  MED_FAR: 2,     // below this: periods + major spans
  MED: 10,        // below this: spans + events, no edges
  NEAR: 50,       // below this: everything + labels
  CLOSE: Infinity // above this: edge labels + derivation badges
};

// ─── Kind → visual mapping ──────────────────────────────────────────────────

const KIND_STYLES = {
  event:    { shape: "circle",  r: 5,  fill: "#2563eb" },
  span:     { shape: "bar",     h: 14, fill: "#2563eb", opacity: 0.3 },
  person:   { shape: "circle",  r: 6,  fill: "#059669" },
  place:    { shape: "diamond", r: 6,  fill: "#6b7280" },
  covenant: { shape: "rect",    w: 10, h: 10, fill: "#7c3aed" },
  book:     { shape: "rect",    w: 12, h: 8,  fill: "#d97706" },
  political:{ shape: "rect",    w: 14, h: 12, fill: "#6b7280", opacity: 0.5 },
  theme:    { shape: "circle",  r: 4,  fill: "#f59e0b", stroke: "#f59e0b", strokeWidth: 2, fillOpacity: 0.3 },
  period:   { shape: "bar",     h: 20, fill: "#6b7280", opacity: 0.15 },
};

const EDGE_COLORS = {
  temporal:   "#2563eb",
  narrative:  "#7c3aed",
  relational: "#059669",
  structural: "#6b7280",
};

function edgeGroup(kind) {
  if (["causes","precedes","concurrent","contains","synchronizes"].includes(kind)) return "temporal";
  if (["responds","prophesies","fulfills","types","escalates","contrasts","covenants"].includes(kind)) return "narrative";
  if (["father_of","teacher_of","succeeds","rival_of","allied_with","vassal_of","located_in","governs"].includes(kind)) return "relational";
  return "structural";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TimelineView({ timelineId }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const zoomRef = useRef({ transform: d3.zoomIdentity, pxPerYear: 1 });

  // ─── Fetch data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timelineId) return;
    setLoading(true);
    getTimeline(timelineId)
      .then(setDoc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [timelineId]);

  // ─── Render ──────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!svg.empty() === false || !container || !doc) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.selectAll("*").remove();

    // Defs (for edge arrowheads)
    const defs = svg.append("defs");
    Object.entries(EDGE_COLORS).forEach(([group, color]) => {
      defs.append("marker")
        .attr("id", `arrow-${group}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 10)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    });

    // Clip path for the viewport
    defs.append("clipPath")
      .attr("id", "timeline-clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    // Main group (zoomable)
    const g = svg.append("g").attr("clip-path", "url(#timeline-clip)");

    // ─── Scale ─────────────────────────────────────────────────────────────
    const yearRange = doc.meta.yearRange;
    const totalYears = yearRange[1] - yearRange[0];

    const xScale = d3.scaleLinear()
      .domain(yearRange)
      .range([0, width]);

    const pxPerYear = width / totalYears;
    zoomRef.current.pxPerYear = pxPerYear;

    // ─── Track lanes ───────────────────────────────────────────────────────
    const tracks = doc.display?.tracks || [];
    const laneHeight = 60;
    const topOffset = 40;
    const totalHeight = topOffset + (tracks.length || 1) * laneHeight + 40;

    // If no tracks, single lane
    const lanes = tracks.length > 0 ? tracks : [{ id: "default", label: "", color: "#2563eb" }];

    // ─── Filter nodes to visible lanes ─────────────────────────────────────
    // Phase 2: render all nodes in a single default lane if no tracks
    // (track filtering is Phase 6)
    const visibleNodes = doc.nodes.filter((n) => n.time?.derived?.start != null);
    const visibleEdges = doc.edges.filter((e) => {
      const from = doc.nodes.find((n) => n.id === e.from);
      const to = doc.nodes.find((n) => n.id === e.to);
      return from?.time?.derived?.start != null && to?.time?.derived?.start != null;
    });

    // ─── LOD culling ───────────────────────────────────────────────────────
    const currentPxPerYear = zoomRef.current.pxPerYear;
    const lod =
      currentPxPerYear < LOD.FAR ? "far" :
      currentPxPerYear < LOD.MED_FAR ? "med-far" :
      currentPxPerYear < LOD.MED ? "med" :
      currentPxPerYear < LOD.NEAR ? "near" : "close";

    // Which nodes to show at this LOD
    const shouldShow = (node) => {
      if (lod === "far") return node.kind === "period";
      if (lod === "med-far") return ["period", "span"].includes(node.kind);
      if (lod === "med") return node.kind !== "event" || !isContainedInSpan(node, doc);
      return true; // near & close: show all
    };

    const shownNodes = visibleNodes.filter(shouldShow);
    const shownNodeIds = new Set(shownNodes.map((n) => n.id));
    const shownEdges = visibleEdges.filter((e) => shownNodeIds.has(e.from) && shownNodeIds.has(e.to));

    // ─── Render axis (bottom) ──────────────────────────────────────────────
    const axisY = height - 30;
    const axisG = g.append("g").attr("transform", `translate(0, ${axisY})`);

    const ticks = xScale.ticks(Math.floor(width / 100));
    axisG.selectAll("line")
      .data(ticks)
      .join("line")
      .attr("x1", (d) => xScale(d))
      .attr("x2", (d) => xScale(d))
      .attr("y1", 0)
      .attr("y2", 6)
      .attr("stroke", "#9ca3af");

    if (lod === "near" || lod === "close") {
      axisG.selectAll("text")
        .data(ticks)
        .join("text")
        .attr("x", (d) => xScale(d))
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("fill", "#6b7280")
        .text((d) => d < 0 ? `${Math.abs(d)} BC` : `${d} AD`);
    }

    // ─── Render lane backgrounds ───────────────────────────────────────────
    lanes.forEach((lane, i) => {
      const y = topOffset + i * laneHeight;
      g.append("rect")
        .attr("x", 0)
        .attr("y", y)
        .attr("width", width)
        .attr("height", laneHeight)
        .attr("fill", i % 2 === 0 ? "#f9fafb" : "#ffffff")
        .attr("stroke", "#e5e7eb")
        .attr("stroke-width", 0.5);

      if (lane.label) {
        g.append("text")
          .attr("x", 8)
          .attr("y", y + 14)
          .attr("font-size", "10px")
          .attr("font-weight", "600")
          .attr("fill", lane.color)
          .text(lane.label.toUpperCase());
      }
    });

    // ─── Render edges (behind nodes) ───────────────────────────────────────
    if (lod === "near" || lod === "close") {
      shownEdges.forEach((edge) => {
        const fromNode = doc.nodes.find((n) => n.id === edge.from);
        const toNode = doc.nodes.find((n) => n.id === edge.to);
        const x1 = xScale(fromNode.time.derived.start);
        const x2 = xScale(toNode.time.derived.start);
        const y = topOffset + laneHeight / 2;

        const group = edgeGroup(edge.kind);
        const color = edge.color || EDGE_COLORS[group];

        g.append("line")
          .attr("x1", x1)
          .attr("x2", x2)
          .attr("y1", y)
          .attr("y2", y)
          .attr("stroke", color)
          .attr("stroke-width", 1.5)
          .attr("marker-end", `url(#arrow-${group})`)
          .attr("opacity", 0.6);

        // Edge label (close LOD only)
        if (lod === "close") {
          const midX = (x1 + x2) / 2;
          g.append("text")
            .attr("x", midX)
            .attr("y", y - 6)
            .attr("text-anchor", "middle")
            .attr("font-size", "9px")
            .attr("fill", color)
            .text(edge.kind);
        }
      });
    }

    // ─── Render nodes ──────────────────────────────────────────────────────
    shownNodes.forEach((node) => {
      const style = KIND_STYLES[node.kind] || KIND_STYLES.event;
      const x = xScale(node.time.derived.start);
      const y = topOffset + laneHeight / 2;

      if (style.shape === "bar") {
        // Spans and periods: horizontal bar
        const start = xScale(node.time.derived.start);
        const end = xScale(node.time.derived.end || node.time.derived.start);
        const barWidth = Math.max(end - start, 4);

        g.append("rect")
          .attr("x", start)
          .attr("y", y - style.h / 2)
          .attr("width", barWidth)
          .attr("height", style.h)
          .attr("rx", 3)
          .attr("fill", style.fill)
          .attr("opacity", style.opacity || 1);

        // Label on bar (near+)
        if (lod === "near" || lod === "close") {
          g.append("text")
            .attr("x", start + barWidth / 2)
            .attr("y", y - style.h / 2 - 4)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("fill", "#374151")
            .text(node.label);
        }
      } else if (style.shape === "circle") {
        g.append("circle")
          .attr("cx", x)
          .attr("cy", y)
          .attr("r", style.r)
          .attr("fill", style.fill)
          .attr("fill-opacity", style.fillOpacity || 1)
          .attr("stroke", style.stroke || "none")
          .attr("stroke-width", style.strokeWidth || 0);

        // Label (near+)
        if (lod === "near" || lod === "close") {
          g.append("text")
            .attr("x", x)
            .attr("y", y - style.r - 4)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("fill", "#374151")
            .text(node.label);
        }
      } else if (style.shape === "diamond") {
        const s = style.r;
        g.append("polygon")
          .attr("points", `${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`)
          .attr("fill", style.fill);

        if (lod === "near" || lod === "close") {
          g.append("text")
            .attr("x", x)
            .attr("y", y - s - 4)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("fill", "#374151")
            .text(node.label);
        }
      } else if (style.shape === "rect") {
        g.append("rect")
          .attr("x", x - style.w / 2)
          .attr("y", y - style.h / 2)
          .attr("width", style.w)
          .attr("height", style.h)
          .attr("rx", 2)
          .attr("fill", style.fill)
          .attr("opacity", style.opacity || 1);

        if (lod === "near" || lod === "close") {
          g.append("text")
            .attr("x", x)
            .attr("y", y - style.h / 2 - 4)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("fill", "#374151")
            .text(node.label);
        }
      }

      // Confidence dimming
      if (node.time?.confidence === "disputed") {
        // Add a small warning dot
        g.append("circle")
          .attr("cx", x + (style.r || 8))
          .attr("cy", y - (style.r || 8))
          .attr("r", 3)
          .attr("fill", "#f59e0b");
      }
    });

    // ─── Zoom / Pan ────────────────────────────────────────────────────────
    const zoom = d3.zoom()
      .scaleExtent([0.1, 50])
      .on("zoom", (event) => {
        const t = event.transform;
        zoomRef.current.transform = t;
        zoomRef.current.pxPerYear = pxPerYear * t.k;

        // Rescale x
        const newX = t.rescaleX(xScale);
        zoomRef.current.scale = newX;

        // Re-render with new scale (simplified: full re-render for Phase 2)
        // In Phase 2+ we'll optimize to only update positions
        g.attr("transform", t);
      });

    svg.call(zoom);

    // Store scale for LOD checks on zoom
    zoomRef.current.baseScale = xScale;
  }, [doc]);

  // ─── Trigger render on data load or container resize ─────────────────────
  useEffect(() => {
    if (!doc || loading) return;
    render();

    const observer = new ResizeObserver(() => render());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [doc, loading, render]);

  // ─── Loading / Error states ──────────────────────────────────────────────
  if (loading) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading timeline…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <span className="text-red-500 text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden bg-white">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isContainedInSpan(node, doc) {
  // Check if this node is a child of a span via "contains" edge
  return doc.edges.some(
    (e) => e.kind === "contains" && e.to === node.id &&
      doc.nodes.find((n) => n.id === e.from)?.kind === "span"
  );
}
