import { describe, it, expect } from "vitest";
import { createMap, setTile } from "@go-op/map";
import { TileType } from "@go-op/types";

describe("createMap", () => {
  it("creates an empty map of the given size", () => {
    const map = createMap(4, 3);
    expect(map.width).toBe(4);
    expect(map.height).toBe(3);
    expect(map.tiles).toHaveLength(12);
    expect(map.tiles.every((t) => t === TileType.Empty)).toBe(true);
  });
});

describe("setTile", () => {
  it("returns a new map with the tile changed", () => {
    const map = createMap(3, 3);
    const updated = setTile(map, 1, 1, TileType.Blocked);

    expect(updated).not.toBe(map);
    expect(updated.tiles[4]).toBe(TileType.Blocked);
    // original unchanged
    expect(map.tiles[4]).toBe(TileType.Empty);
  });

  it("preserves other tiles", () => {
    const map = createMap(3, 3);
    const updated = setTile(map, 0, 0, TileType.Blocked);
    expect(updated.tiles[1]).toBe(TileType.Empty);
    expect(updated.tiles[0]).toBe(TileType.Blocked);
  });
});
