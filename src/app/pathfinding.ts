// ─────────────────────────────────────────────────────────
//  A* (A-Star) Pathfinding for Manhattan / Orthogonal
//  Wire Routing on a 2-D Grid
//
//  Finds the shortest L-shaped path between two grid
//  points while avoiding obstacle cells (logic gates).
//  Returns a list of waypoints that form an SVG polyline.
// ─────────────────────────────────────────────────────────

import type { AStarNode, Point, Rect } from './types';

// Cardinal directions (no diagonals → Manhattan routing)
const DIRS: Point[] = [
  { x: 0, y: -1 }, // up
  { x: 1, y: 0 },  // right
  { x: 0, y: 1 },  // down
  { x: -1, y: 0 }, // left
];

/**
 * Build a 2-D walkability grid.
 *
 * @param gridWidth   Number of columns
 * @param gridHeight  Number of rows
 * @param obstacles   Array of Rects (in grid units) that are blocked
 * @param extraClear  Extra cells around each obstacle to keep clear (padding)
 * @returns A 2-D boolean array where `true` = walkable
 */
export function buildGrid(
  gridWidth: number,
  gridHeight: number,
  obstacles: Rect[],
  extraClear = 0,
): boolean[][] {
  // Initialise grid – all walkable
  const grid: boolean[][] = Array.from({ length: gridHeight }, () =>
    Array.from({ length: gridWidth }, () => true),
  );

  // Mark obstacle cells + padding as non-walkable
  for (const obs of obstacles) {
    const x0 = Math.max(0, Math.floor(obs.x) - extraClear);
    const y0 = Math.max(0, Math.floor(obs.y) - extraClear);
    const x1 = Math.min(gridWidth - 1, Math.ceil(obs.x + obs.width) + extraClear);
    const y1 = Math.min(gridHeight - 1, Math.ceil(obs.y + obs.height) + extraClear);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        grid[y][x] = false;
      }
    }
  }

  return grid;
}

/** Manhattan-distance heuristic */
function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Encode grid coordinates into a single string key */
function key(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * A* pathfinding on an orthogonal grid.
 *
 * @param grid       2-D walkability array (true = passable)
 * @param start      Start point (grid coordinates)
 * @param end        End point (grid coordinates)
 * @param turnCost   Extra cost for changing direction (encourages straighter paths)
 * @returns          Array of grid-coordinate waypoints, or null if no path found
 */
export function aStarSearch(
  grid: boolean[][],
  start: Point,
  end: Point,
  turnCost = 0.5,
): Point[] | null {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (rows === 0 || cols === 0) return null;

  // Bounds check
  const inBounds = (x: number, y: number) =>
    x >= 0 && x < cols && y >= 0 && y < rows;

  // Ensure start and end are walkable (force them open so pins at the
  // edge of a component still work)
  if (!inBounds(start.x, start.y) || !inBounds(end.x, end.y)) return null;

  // Open set (simple array – fine for grids up to ~200 × 200)
  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();

  // Direction that led to each node (for turn-cost penalisation)
  const dirMap = new Map<string, Point>();

  const startNode: AStarNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, end),
    f: heuristic(start, end),
    parent: null,
  };

  openSet.push(startNode);

  while (openSet.length > 0) {
    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (
        openSet[i].f < openSet[bestIdx].f ||
        (openSet[i].f === openSet[bestIdx].f && openSet[i].h < openSet[bestIdx].h)
      ) {
        bestIdx = i;
      }
    }

    const current = openSet[bestIdx];
    openSet.splice(bestIdx, 1);

    const ck = key(current.x, current.y);
    if (closedSet.has(ck)) continue;
    closedSet.add(ck);

    // Reached the goal?
    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(current);
    }

    const parentDir = dirMap.get(ck) ?? null;

    for (const dir of DIRS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const nk = key(nx, ny);

      if (!inBounds(nx, ny)) continue;
      if (closedSet.has(nk)) continue;

      // Allow walking on start / end even if blocked
      const isEndpoint =
        (nx === start.x && ny === start.y) || (nx === end.x && ny === end.y);
      if (!grid[ny][nx] && !isEndpoint) continue;

      // Base movement cost = 1
      let moveCost = 1;
      // Penalise turns
      if (parentDir && (dir.x !== parentDir.x || dir.y !== parentDir.y)) {
        moveCost += turnCost;
      }

      const tentativeG = current.g + moveCost;
      const h = heuristic({ x: nx, y: ny }, end);

      // Check if a better route to this neighbour already exists in open set
      const existing = openSet.find((n) => n.x === nx && n.y === ny);
      if (existing && tentativeG >= existing.g) continue;

      const neighbour: AStarNode = {
        x: nx,
        y: ny,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current,
      };

      dirMap.set(nk, dir);

      if (existing) {
        // Update in place
        existing.g = tentativeG;
        existing.h = h;
        existing.f = tentativeG + h;
        existing.parent = current;
      } else {
        openSet.push(neighbour);
      }
    }
  }

  // No path found – fall back to simple L-shaped path
  return fallbackPath(start, end);
}

/** Reconstruct waypoints from the goal node back to the start */
function reconstructPath(node: AStarNode): Point[] {
  const raw: Point[] = [];
  let cur: AStarNode | null = node;
  while (cur) {
    raw.unshift({ x: cur.x, y: cur.y });
    cur = cur.parent;
  }
  // Simplify: remove collinear intermediate points
  return simplifyPath(raw);
}

/**
 * Remove redundant collinear waypoints so the polyline
 * only contains corner points.
 */
function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;
  const result: Point[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // Keep the point if the direction changes (it's a corner)
    if (dx1 !== dx2 || dy1 !== dy2) {
      result.push(curr);
    }
  }

  result.push(path[path.length - 1]);
  return result;
}

/**
 * Fallback: simple two-segment L-shaped path (no obstacle avoidance).
 * Used when A* finds no route.
 */
function fallbackPath(start: Point, end: Point): Point[] {
  // Horizontal first, then vertical
  if (start.x === end.x || start.y === end.y) {
    return [start, end]; // straight line
  }
  const mid: Point = { x: end.x, y: start.y };
  return [start, mid, end];
}

/**
 * High-level convenience: route a wire between two pixel-coordinate pins
 * on the simulator canvas.
 *
 * @param startPx     Start pixel position
 * @param endPx       End pixel position
 * @param obstacles   Rects in grid units that should be avoided
 * @param gridSize    Pixel size of one grid cell
 * @param canvasW     Canvas width in pixels
 * @param canvasH     Canvas height in pixels
 * @returns           Array of *pixel-coordinate* waypoints for an SVG polyline
 */
export function routeWire(
  startPx: Point,
  endPx: Point,
  obstacles: Rect[],
  gridSize: number,
  canvasW: number,
  canvasH: number,
): Point[] {
  const gridW = Math.ceil(canvasW / gridSize);
  const gridH = Math.ceil(canvasH / gridSize);

  // Convert px → grid
  const startGrid: Point = {
    x: Math.round(startPx.x / gridSize),
    y: Math.round(startPx.y / gridSize),
  };
  const endGrid: Point = {
    x: Math.round(endPx.x / gridSize),
    y: Math.round(endPx.y / gridSize),
  };

  const grid = buildGrid(gridW, gridH, obstacles, 0);
  const pathGrid = aStarSearch(grid, startGrid, endGrid);

  if (!pathGrid) {
    // Absolute fallback: straight L
    return fallbackPath(startPx, endPx);
  }

  // Convert grid → px
  return pathGrid.map((p) => ({
    x: p.x * gridSize,
    y: p.y * gridSize,
  }));
}
