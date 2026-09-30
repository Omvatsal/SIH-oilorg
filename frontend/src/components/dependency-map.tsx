import { useRef, useState } from "react";
import type { DependencyGraph } from "../lib/types";

export function DependencyMap({ graph }: { graph: DependencyGraph }) {
  const [zoom, setZoom] = useState(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const nodes = new Map(graph.nodes.map(node => [node.activity_id, node]));
  const order = graph.topological_order.length === graph.nodes.length
    ? graph.topological_order
    : graph.nodes.map(node => node.activity_id);
  const levels = new Map<string, number>();
  order.forEach(id => {
    const parentLevels = (nodes.get(id)?.predecessor_ids ?? [])
      .map(parent => levels.get(parent))
      .filter((level): level is number => level !== undefined);
    levels.set(id, parentLevels.length ? Math.max(...parentLevels) + 1 : 0);
  });
  const columns = new Map<number, string[]>();
  order.forEach(id => {
    const level = levels.get(id) ?? 0;
    columns.set(level, [...(columns.get(level) ?? []), id]);
  });
  const boxWidth = 176, boxHeight = 54, columnGap = 216, rowGap = 76, padding = 24;
  const width = padding * 2 + Math.max(0, ...columns.keys()) * columnGap + boxWidth;
  const height = padding * 2 + (Math.max(1, ...[...columns.values()].map(column => column.length)) - 1) * rowGap + boxHeight;
  const positions = new Map<string, { x: number; y: number }>();
  columns.forEach((ids, column) => ids.forEach((id, row) => positions.set(id, { x: padding + column * columnGap, y: padding + row * rowGap })));

  return <div className="dependency-map-wrap">
    <div className="dependency-map-help"><span>Dependency map · Ctrl/⌘ + scroll or pinch to zoom</span><span>{Math.round(zoom * 100)}%</span></div>
    <div className="dependency-map" role="region" aria-label="Activity dependency map" tabIndex={0}
      onWheelCapture={event => { if (event.ctrlKey || event.metaKey) event.preventDefault(); }}
      onWheel={event => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); event.stopPropagation(); setZoom(value => Math.max(.5, Math.min(2.5, Number((value - event.deltaY * .003).toFixed(2))))); }}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.current.size === 2) { const [first, second] = [...pointers.current.values()]; pinchStart.current = { distance: Math.hypot(first.x - second.x, first.y - second.y), zoom }; } }}
      onPointerMove={event => { if (!pointers.current.has(event.pointerId)) return; event.preventDefault(); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.current.size === 2 && pinchStart.current) { const [first, second] = [...pointers.current.values()]; const distance = Math.hypot(first.x - second.x, first.y - second.y); setZoom(Math.max(.5, Math.min(2.5, Number((pinchStart.current.zoom * distance / pinchStart.current.distance).toFixed(2))))); } }}
      onPointerUp={event => { pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinchStart.current = null; }}
      onPointerCancel={event => { pointers.current.delete(event.pointerId); pinchStart.current = null; }}>
    <svg width={width * zoom} height={height * zoom} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="dependency-title">
      <title id="dependency-title">Activity dependencies. Lines connect prerequisites to dependent activities.</title>
      <defs><marker id="dependency-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8z" fill="currentColor" /></marker></defs>
      {graph.edges.map((edge, index) => {
        const start = positions.get(edge.predecessor_id), end = positions.get(edge.successor_id);
        return start && end ? <line key={`${edge.predecessor_id}-${edge.successor_id}-${index}`} className={edge.resolved ? "dependency-edge" : "dependency-edge missing"} x1={start.x + boxWidth} y1={start.y + boxHeight / 2} x2={end.x} y2={end.y + boxHeight / 2} markerEnd="url(#dependency-arrow)" /> : null;
      })}
      {order.map(id => {
        const point = positions.get(id), node = nodes.get(id);
        return point && node ? <g key={id} className="dependency-node" transform={`translate(${point.x},${point.y})`}><rect width={boxWidth} height={boxHeight} rx="5" /><text x="11" y="21" className="dependency-id">{id}</text><text x="11" y="40" className="dependency-name">{node.activity_name.slice(0, 24)}</text></g> : null;
      })}
    </svg></div>
  </div>;
}
