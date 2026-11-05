/**
 * timelineContainment.js
 * Precomputes the containment hierarchy from "contains" edges.
 * Built once per document load; invalidated on structural change.
 */

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @returns {Map<string, string|null>} nodeId → parentId (null = root)
 */
export function buildContainmentTree(nodes, edges) {
  const parentOf = new Map();
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    parentOf.set(node.id, null);
  }

  for (const edge of edges) {
    if (edge.kind === 'contains' && nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      parentOf.set(edge.to, edge.from);
    }
  }

  return parentOf;
}

/**
 * Determines which nodes are visible at a given zoom level,
 * using the containment tree for absorption culling.
 *
 * @param {object[]} nodes - all time-stamped nodes
 * @param {Map<string, string|null>} parentOf - containment tree
 * @param {number} pxPerYear - current zoom
 * @param {function} xScale - d3 scale (year → pixel)
 * @returns {Set<string>} visible node IDs
 */
export function cullByContainment(nodes, parentOf, pxPerYear, xScale) {
  const visible = new Set();

  // Compute visual width for each node
  const widths = new Map();
  for (const node of nodes) {
    const d = node.time?.derived;
    if (!d?.start) continue;
    if (d.end != null) {
      widths.set(node.id, Math.abs(xScale(d.end) - xScale(d.start)));
    } else {
      widths.set(node.id, 8); // event dot
    }
  }

  // A node is hidden if its parent is visible AND
  // child width < 40% of parent width AND parent width < 60px
  function isVisible(nodeId) {
    if (visible.has(nodeId)) return true;

    const parent = parentOf.get(nodeId);
    if (parent === null || parent === undefined) {
      // Root node: visible if it has a width
      if (widths.has(nodeId)) visible.add(nodeId);
      return widths.has(nodeId);
    }

    const parentVisible = isVisible(parent);
    if (!parentVisible) return false;

    const childW = widths.get(nodeId) || 0;
    const parentW = widths.get(parent) || 0;

    // Absorb: child is small relative to parent, and parent is small on screen
    if (childW < parentW * 0.4 && parentW < 60) {
      return false;
    }

    visible.add(nodeId);
    return true;
  }

  for (const node of nodes) {
    isVisible(node.id);
  }

  return visible;
}
