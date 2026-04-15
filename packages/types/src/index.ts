// ---------------------------------------------------------------------------
// Tile Types
// ---------------------------------------------------------------------------

export const TileType = {
  Empty: 0,
  Blocked: 1,
} as const;

export type TileType = (typeof TileType)[keyof typeof TileType];

// ---------------------------------------------------------------------------
// Tile Position (integer grid coordinates)
// ---------------------------------------------------------------------------

export interface TilePos {
  readonly x: number;
  readonly y: number;
}

export function createTilePos(x: number, y: number): TilePos {
  return { x, y };
}

// ---------------------------------------------------------------------------
// Tile Map (flat row-major array)
// ---------------------------------------------------------------------------

export interface TileMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly TileType[];
}

export function tileIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

export function isInBounds(map: TileMap, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height;
}

export function tileAt(map: TileMap, x: number, y: number): TileType {
  return map.tiles[tileIndex(x, y, map.width)]!;
}

export function isWalkable(map: TileMap, x: number, y: number): boolean {
  return isInBounds(map, x, y) && tileAt(map, x, y) === TileType.Empty;
}

// ---------------------------------------------------------------------------
// Game Entities
// ---------------------------------------------------------------------------

export interface Unit {
  readonly id: string;
  readonly pos: TilePos;
}

export interface GameState {
  readonly map: TileMap;
  readonly units: readonly Unit[];
}
