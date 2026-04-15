import {
  type TileMap,
  type TilePos,
  type TileType,
  TileType as TT,
  tileIndex,
  isWalkable,
} from "@go-op/types";

// ---------------------------------------------------------------------------
// Map Creation
// ---------------------------------------------------------------------------

export function createMap(width: number, height: number): TileMap {
  return {
    width,
    height,
    tiles: new Array(width * height).fill(TT.Empty) as TileType[],
  };
}

export function setTile(
  map: TileMap,
  x: number,
  y: number,
  type: TileType,
): TileMap {
  const tiles = [...map.tiles];
  tiles[tileIndex(x, y, map.width)] = type;
  return { ...map, tiles };
}

// ---------------------------------------------------------------------------
// A* Pathfinding (4-directional, deterministic)
// ---------------------------------------------------------------------------

// Neighbor order is fixed for deterministic tie-breaking: E, S, W, N
const DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function heuristic(a: TilePos, b: TilePos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function posKey(x: number, y: number): number {
  return (y << 16) | (x & 0xffff);
}

export function findPath(
  map: TileMap,
  from: TilePos,
  to: TilePos,
): TilePos[] | null {
  if (!isWalkable(map, from.x, from.y) || !isWalkable(map, to.x, to.y)) {
    return null;
  }

  if (from.x === to.x && from.y === to.y) {
    return [{ x: from.x, y: from.y }];
  }

  // Open set as a simple sorted array (adequate for POC grid sizes)
  const open: { x: number; y: number; g: number; f: number }[] = [];
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();

  const startKey = posKey(from.x, from.y);
  const h = heuristic(from, to);
  open.push({ x: from.x, y: from.y, g: 0, f: h });
  gScore.set(startKey, 0);

  while (open.length > 0) {
    // Find node with lowest f-score (stable: first inserted wins ties)
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIdx]!.f) {
        bestIdx = i;
      }
    }
    const current = open[bestIdx]!;
    open.splice(bestIdx, 1);

    if (current.x === to.x && current.y === to.y) {
      return reconstructPath(cameFrom, current.x, current.y, from);
    }

    const currentKey = posKey(current.x, current.y);

    for (const [dx, dy] of DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (!isWalkable(map, nx, ny)) continue;

      const tentativeG = current.g + 1;
      const nk = posKey(nx, ny);
      const prevG = gScore.get(nk);

      if (prevG === undefined || tentativeG < prevG) {
        gScore.set(nk, tentativeG);
        cameFrom.set(nk, currentKey);
        const f = tentativeG + heuristic({ x: nx, y: ny }, to);
        open.push({ x: nx, y: ny, g: tentativeG, f });
      }
    }
  }

  return null;
}

function reconstructPath(
  cameFrom: Map<number, number>,
  endX: number,
  endY: number,
  from: TilePos,
): TilePos[] {
  const path: TilePos[] = [];
  let cx = endX;
  let cy = endY;

  while (cx !== from.x || cy !== from.y) {
    path.push({ x: cx, y: cy });
    const prev = cameFrom.get(posKey(cx, cy))!;
    cx = prev & 0xffff;
    // Sign-extend from 16-bit
    cy = prev >> 16;
  }
  path.push({ x: from.x, y: from.y });
  path.reverse();
  return path;
}

// ---------------------------------------------------------------------------
// Isometric Coordinate Conversion
// ---------------------------------------------------------------------------

/**
 * Convert tile grid coordinates to isometric screen position.
 * Uses the standard diamond projection:
 *   sx = (x - y) * (tileWidth / 2)
 *   sy = (x + y) * (tileHeight / 2)
 */
export function tileToScreen(
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number,
): { sx: number; sy: number } {
  return {
    sx: (tileX - tileY) * (tileWidth / 2),
    sy: (tileX + tileY) * (tileHeight / 2),
  };
}

/**
 * Convert isometric screen position back to tile grid coordinates.
 * Inverse of tileToScreen, floored to nearest tile.
 */
export function screenToTile(
  sx: number,
  sy: number,
  tileWidth: number,
  tileHeight: number,
): { tileX: number; tileY: number } {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  const tileX = Math.floor((sx / halfW + sy / halfH) / 2);
  const tileY = Math.floor((sy / halfH - sx / halfW) / 2);
  return { tileX, tileY };
}
