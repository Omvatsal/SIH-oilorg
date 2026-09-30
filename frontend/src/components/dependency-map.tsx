import type { DependencyGraph } from "../lib/types";

export function DependencyMap({ graph }: { graph: DependencyGraph }) {
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

  return <div className="dependency-map" role="region" aria-label="Activity dependency map" tabIndex={0}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="dependency-title">
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
    </svg>
  </div>;
}
