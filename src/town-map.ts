export type Point = { x: number; y: number };
export type RoadLocation = {
  edge: number;
  t: number;
  point: Point;
  distance: number;
  area?: number;
};
export const MAP_WIDTH = 1672;
export const MAP_HEIGHT = 941;
export const ROAD_CLICK_RADIUS = 36;
export function mapPoint(x: number, y: number): Point {
  return { x: x * MAP_WIDTH, y: y * MAP_HEIGHT };
}

// Waypoints follow the stone paths in the approved background.
export const roadNodes = [
  mapPoint(0.5, 0.87),
  mapPoint(0.5, 0.77),
  mapPoint(0.5, 0.65),
  mapPoint(0.42, 0.61),
  mapPoint(0.39, 0.56),
  mapPoint(0.41, 0.5),
  mapPoint(0.43, 0.43),
  mapPoint(0.35, 0.34),
  mapPoint(0.51, 0.34),
  mapPoint(0.6, 0.34),
  mapPoint(0.68, 0.34),
  mapPoint(0.68, 0.3),
  mapPoint(0.72, 0.39),
  mapPoint(0.7, 0.46),
  mapPoint(0.65, 0.53),
  mapPoint(0.6, 0.57),
  mapPoint(0.72, 0.65),
  mapPoint(0.8, 0.65),
  mapPoint(0.8, 0.69),
  mapPoint(0.76, 0.75),
  mapPoint(0.66, 0.78),
  mapPoint(0.35, 0.8),
  mapPoint(0.24, 0.77),
  mapPoint(0.2, 0.7),
  mapPoint(0.18, 0.65),
  mapPoint(0.27, 0.37),
  mapPoint(0.24, 0.42),
  mapPoint(0.25, 0.48),
  mapPoint(0.28, 0.55),
  mapPoint(0.3, 0.61),
  mapPoint(0.29, 0.66),
  mapPoint(0.35, 0.59),
];
export const roadEdges: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [7, 8],
  [6, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [10, 12],
  [12, 13],
  [13, 14],
  [14, 15],
  [15, 2],
  [14, 16],
  [16, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [20, 1],
  [1, 21],
  [21, 22],
  [22, 23],
  [23, 24],
  [7, 25],
  [25, 26],
  [26, 27],
  [27, 28],
  [28, 29],
  [29, 30],
  [29, 31],
  [31, 4],
];
export type RoadGraph = {
  nodes: Point[];
  edges: [number, number][];
  walkAreas?: Point[][];
};
export const townGraph: RoadGraph = { nodes: roadNodes, edges: roadEdges };

export function pointInWalkArea(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j],
      b = polygon[i];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (
      Math.abs(cross) < 0.0001 &&
      point.x >= Math.min(a.x, b.x) - 0.0001 &&
      point.x <= Math.max(a.x, b.x) + 0.0001 &&
      point.y >= Math.min(a.y, b.y) - 0.0001 &&
      point.y <= Math.max(a.y, b.y) + 0.0001
    )
      return true;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

function segmentInWalkArea(a: Point, b: Point, polygon: Point[]): boolean {
  if (!pointInWalkArea(a, polygon) || !pointInWalkArea(b, polygon))
    return false;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    cuts = [0, 1];
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i],
      d = polygon[(i + 1) % polygon.length],
      ex = d.x - c.x,
      ey = d.y - c.y;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 0.000001) continue;
    const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / denominator;
    const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / denominator;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
  }
  cuts.sort((x, y) => x - y);
  return cuts.slice(1).every((cut, i) => {
    const t = (cuts[i] + cut) / 2;
    return pointInWalkArea({ x: a.x + dx * t, y: a.y + dy * t }, polygon);
  });
}

export function locateWalkTarget(point: Point, graph: RoadGraph): RoadLocation {
  const nearest = nearestRoad(point, graph);
  const area =
    graph.walkAreas?.findIndex((polygon) => pointInWalkArea(point, polygon)) ??
    -1;
  if (area >= 0) return { ...nearest, point: { ...point }, distance: 0, area };
  return nearest;
}
export function nearestRoad(
  point: Point,
  graph: RoadGraph = townGraph,
): RoadLocation {
  const { nodes: roadNodes, edges: roadEdges } = graph;
  let nearest: RoadLocation = {
    edge: 0,
    t: 0,
    point: roadNodes[0],
    distance: Infinity,
  };
  roadEdges.forEach(([from, to], edge) => {
    const a = roadNodes[from],
      b = roadNodes[to],
      dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy),
      ),
    );
    const projected = { x: a.x + t * dx, y: a.y + t * dy };
    const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
    if (distance < nearest.distance)
      nearest = { edge, t, point: projected, distance };
  });
  return nearest;
}
export function findRoadRoute(
  start: Point,
  target: RoadLocation,
  graph: RoadGraph = townGraph,
): Point[] {
  const { nodes: roadNodes, edges: roadEdges } = graph;
  const source = locateWalkTarget(start, graph);
  const walkAreas = graph.walkAreas ?? [];
  const points = [
    ...roadNodes,
    ...walkAreas.flat(),
    source.point,
    target.point,
  ];
  const startIndex = points.length - 2,
    targetIndex = points.length - 1;
  const edges: [number, number][] = [...roadEdges];
  if (source.area === undefined)
    edges.push(
      [startIndex, roadEdges[source.edge][0]],
      [startIndex, roadEdges[source.edge][1]],
    );
  if (target.area === undefined)
    edges.push(
      [targetIndex, roadEdges[target.edge][0]],
      [targetIndex, roadEdges[target.edge][1]],
    );
  if (
    source.area === undefined &&
    target.area === undefined &&
    source.edge === target.edge
  )
    edges.push([startIndex, targetIndex]);
  // Visibility links keep travel inside each plaza, including concave boundaries.
  for (let a = 0; a < points.length; a++) {
    for (let b = a + 1; b < points.length; b++) {
      if (
        walkAreas.some((polygon) =>
          segmentInWalkArea(points[a], points[b], polygon),
        )
      )
        edges.push([a, b]);
    }
  }
  const distances = points.map(() => Infinity),
    previous = points.map(() => -1),
    visited = new Set<number>();
  distances[startIndex] = 0;
  while (visited.size < points.length) {
    let current = -1;
    for (let i = 0; i < points.length; i++)
      if (
        !visited.has(i) &&
        (current === -1 || distances[i] < distances[current])
      )
        current = i;
    if (current === -1 || distances[current] === Infinity) return [];
    if (current === targetIndex) break;
    visited.add(current);
    for (const [a, b] of edges) {
      if (a !== current && b !== current) continue;
      const neighbor = a === current ? b : a;
      const distance =
        distances[current] +
        Math.hypot(
          points[current].x - points[neighbor].x,
          points[current].y - points[neighbor].y,
        );
      if (distance < distances[neighbor]) {
        distances[neighbor] = distance;
        previous[neighbor] = current;
      }
    }
  }
  const result: Point[] = [];
  for (let at = targetIndex; at !== -1; at = previous[at])
    result.unshift(points[at]);
  return result.slice(1);
}
export const places = [
  {
    name: "姜饼工坊",
    node: 7,
    depth: 0.34,
    description: "红白遮阳棚、姜饼招牌和暖色橱窗。门前预留制作与装饰互动入口。",
    polygon: [
      [0.14, 0.09],
      [0.25, 0.015],
      [0.37, 0.04],
      [0.42, 0.2],
      [0.39, 0.32],
      [0.21, 0.35],
      [0.15, 0.29],
    ],
  },
  {
    name: "铃铛音乐亭",
    node: 11,
    depth: 0.3,
    description: "悬挂铃铛与开放木亭，台阶前留出独立互动空间。",
    polygon: [
      [0.62, 0.1],
      [0.69, 0.04],
      [0.77, 0.07],
      [0.79, 0.19],
      [0.76, 0.29],
      [0.65, 0.3],
    ],
  },
  {
    name: "雪橇驿站",
    node: 24,
    depth: 0.65,
    description: "开放木棚中停着圣诞雪橇，宽入口与门前道路相连。",
    polygon: [
      [0.035, 0.45],
      [0.13, 0.34],
      [0.21, 0.37],
      [0.27, 0.5],
      [0.26, 0.65],
      [0.08, 0.68],
      [0.035, 0.61],
    ],
  },
  {
    name: "礼物小屋",
    node: 17,
    depth: 0.65,
    description: "大蝴蝶结标记入口，檐下陈列彩色礼物，门前是独立停留区。",
    polygon: [
      [0.73, 0.41],
      [0.8, 0.31],
      [0.88, 0.32],
      [0.94, 0.45],
      [0.96, 0.59],
      [0.94, 0.65],
      [0.8, 0.67],
      [0.73, 0.58],
    ],
  },
  {
    name: "圣诞愿望树",
    node: 2,
    depth: 0.59,
    description: "环形树池、灯串与树顶星组成小镇主视觉，树前广场供卜卜停留。",
    polygon: [
      [0.49, 0.13],
      [0.53, 0.14],
      [0.55, 0.23],
      [0.56, 0.29],
      [0.58, 0.36],
      [0.59, 0.41],
      [0.63, 0.51],
      [0.6, 0.55],
      [0.58, 0.59],
      [0.44, 0.6],
      [0.43, 0.55],
      [0.4, 0.52],
      [0.43, 0.42],
      [0.44, 0.35],
      [0.46, 0.27],
    ],
  },
];
