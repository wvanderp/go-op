import { describe, it, expect } from "vitest";
import {
  TileType,
  type TilePos,
  type Unit,
  type TileMap,
  type GameState,
  createTilePos,
  tileIndex,
  tileAt,
  isWalkable,
  isInBounds,
} from "@go-op/types";

describe("TileType", () => {
  it("has Empty and Blocked values", () => {
    expect(TileType.Empty).toBe(0);
    expect(TileType.Blocked).toBe(1);
  });
});

describe("createTilePos", () => {
  it("creates a tile position", () => {
    const pos = createTilePos(3, 7);
    expect(pos.x).toBe(3);
    expect(pos.y).toBe(7);
  });
});

describe("tileIndex", () => {
  it("computes row-major index", () => {
    expect(tileIndex(0, 0, 10)).toBe(0);
    expect(tileIndex(5, 0, 10)).toBe(5);
    expect(tileIndex(0, 1, 10)).toBe(10);
    expect(tileIndex(3, 2, 10)).toBe(23);
  });
});

describe("isInBounds", () => {
  const map: TileMap = {
    width: 4,
    height: 3,
    tiles: new Array(12).fill(TileType.Empty),
  };

  it("returns true for valid coordinates", () => {
    expect(isInBounds(map, 0, 0)).toBe(true);
    expect(isInBounds(map, 3, 2)).toBe(true);
  });

  it("returns false for out-of-bounds coordinates", () => {
    expect(isInBounds(map, -1, 0)).toBe(false);
    expect(isInBounds(map, 4, 0)).toBe(false);
    expect(isInBounds(map, 0, -1)).toBe(false);
    expect(isInBounds(map, 0, 3)).toBe(false);
  });
});

describe("tileAt", () => {
  it("returns tile type at coordinates", () => {
    const tiles = new Array(9).fill(TileType.Empty);
    tiles[4] = TileType.Blocked; // (1, 1) in 3x3
    const map: TileMap = { width: 3, height: 3, tiles };

    expect(tileAt(map, 0, 0)).toBe(TileType.Empty);
    expect(tileAt(map, 1, 1)).toBe(TileType.Blocked);
    expect(tileAt(map, 2, 2)).toBe(TileType.Empty);
  });
});

describe("isWalkable", () => {
  it("returns true for empty tiles", () => {
    const map: TileMap = {
      width: 2,
      height: 2,
      tiles: [TileType.Empty, TileType.Blocked, TileType.Empty, TileType.Empty],
    };
    expect(isWalkable(map, 0, 0)).toBe(true);
    expect(isWalkable(map, 0, 1)).toBe(true);
  });

  it("returns false for blocked tiles", () => {
    const map: TileMap = {
      width: 2,
      height: 2,
      tiles: [TileType.Empty, TileType.Blocked, TileType.Empty, TileType.Empty],
    };
    expect(isWalkable(map, 1, 0)).toBe(false);
  });

  it("returns false for out-of-bounds coordinates", () => {
    const map: TileMap = {
      width: 2,
      height: 2,
      tiles: [TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty],
    };
    expect(isWalkable(map, -1, 0)).toBe(false);
    expect(isWalkable(map, 2, 0)).toBe(false);
  });
});

describe("type shapes", () => {
  it("Unit has id, pos, movement speed, and action", () => {
    const unit: Unit = {
      id: "u1",
      pos: createTilePos(5, 3),
      speedTilesPerSecond: 2,
      action: { type: "idle" },
    };
    expect(unit.id).toBe("u1");
    expect(unit.pos.x).toBe(5);
    expect(unit.pos.y).toBe(3);
    expect(unit.speedTilesPerSecond).toBe(2);
    expect(unit.action.type).toBe("idle");
  });

  it("GameState has map and units", () => {
    const map: TileMap = { width: 2, height: 2, tiles: [0, 0, 0, 0] };
    const state: GameState = {
      map,
      units: [{ id: "u1", pos: createTilePos(0, 0), speedTilesPerSecond: 1, action: { type: "idle" } }],
    };
    expect(state.map).toBe(map);
    expect(state.units).toHaveLength(1);
    expect(state.units[0]!.speedTilesPerSecond).toBe(1);
  });
});
