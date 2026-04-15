import { describe, it, expect } from "vitest";
import { findPath, createMap, setTile } from "@go-op/map";
import { TileType, createTilePos } from "@go-op/types";

describe("findPath", () => {
  it("finds a straight horizontal path", () => {
    const map = createMap(5, 5);
    const path = findPath(map, createTilePos(0, 0), createTilePos(4, 0));
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 0 });
    expect(path!).toHaveLength(5);
  });

  it("finds a straight vertical path", () => {
    const map = createMap(5, 5);
    const path = findPath(map, createTilePos(0, 0), createTilePos(0, 4));
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 0, y: 4 });
    expect(path!).toHaveLength(5);
  });

  it("returns path of length 1 when start equals end", () => {
    const map = createMap(5, 5);
    const path = findPath(map, createTilePos(2, 2), createTilePos(2, 2));
    expect(path).toEqual([{ x: 2, y: 2 }]);
  });

  it("finds a path around an obstacle", () => {
    // Create a wall blocking the direct path
    //   0 1 2 3 4
    // 0 S . . . .
    // 1 . # . . .
    // 2 . # . . .
    // 3 . # . . .
    // 4 . . . . E
    let map = createMap(5, 5);
    map = setTile(map, 1, 1, TileType.Blocked);
    map = setTile(map, 1, 2, TileType.Blocked);
    map = setTile(map, 1, 3, TileType.Blocked);

    const path = findPath(map, createTilePos(0, 0), createTilePos(4, 4));
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 4 });
    // Path should not pass through any blocked tiles
    for (const step of path!) {
      expect(map.tiles[step.y * map.width + step.x]).toBe(TileType.Empty);
    }
  });

  it("returns null when target is unreachable", () => {
    // Surround the start position
    //   0 1 2
    // 0 . # .
    // 1 # S #
    // 2 . # .
    let map = createMap(3, 3);
    map = setTile(map, 1, 0, TileType.Blocked);
    map = setTile(map, 0, 1, TileType.Blocked);
    map = setTile(map, 2, 1, TileType.Blocked);
    map = setTile(map, 1, 2, TileType.Blocked);

    const path = findPath(map, createTilePos(1, 1), createTilePos(0, 0));
    expect(path).toBeNull();
  });

  it("returns null when target is blocked", () => {
    let map = createMap(3, 3);
    map = setTile(map, 2, 2, TileType.Blocked);
    const path = findPath(map, createTilePos(0, 0), createTilePos(2, 2));
    expect(path).toBeNull();
  });

  it("returns null when start is blocked", () => {
    let map = createMap(3, 3);
    map = setTile(map, 0, 0, TileType.Blocked);
    const path = findPath(map, createTilePos(0, 0), createTilePos(2, 2));
    expect(path).toBeNull();
  });

  it("produces deterministic results", () => {
    const map = createMap(10, 10);
    const from = createTilePos(0, 0);
    const to = createTilePos(9, 9);
    const path1 = findPath(map, from, to);
    const path2 = findPath(map, from, to);
    expect(path1).toEqual(path2);
  });

  it("uses 4-directional movement only", () => {
    const map = createMap(3, 3);
    const path = findPath(map, createTilePos(0, 0), createTilePos(2, 2));
    expect(path).not.toBeNull();
    // Each step should differ by exactly 1 in either x or y, not both
    for (let i = 1; i < path!.length; i++) {
      const dx = Math.abs(path![i]!.x - path![i - 1]!.x);
      const dy = Math.abs(path![i]!.y - path![i - 1]!.y);
      expect(dx + dy).toBe(1);
    }
  });
});
