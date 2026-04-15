import { describe, it, expect } from "vitest";
import { tileToScreen, screenToTile } from "@go-op/map";

describe("tileToScreen", () => {
  const tw = 64;
  const th = 32;

  it("converts origin tile to screen center", () => {
    const { sx, sy } = tileToScreen(0, 0, tw, th);
    expect(sx).toBe(0);
    expect(sy).toBe(0);
  });

  it("converts tile (1, 0) — right in iso space", () => {
    const { sx, sy } = tileToScreen(1, 0, tw, th);
    // iso: sx = (x - y) * tw/2, sy = (x + y) * th/2
    expect(sx).toBe(32); // (1-0) * 32
    expect(sy).toBe(16); // (1+0) * 16
  });

  it("converts tile (0, 1) — left in iso space", () => {
    const { sx, sy } = tileToScreen(0, 1, tw, th);
    expect(sx).toBe(-32); // (0-1) * 32
    expect(sy).toBe(16); // (0+1) * 16
  });

  it("converts tile (3, 2)", () => {
    const { sx, sy } = tileToScreen(3, 2, tw, th);
    expect(sx).toBe(32); // (3-2) * 32
    expect(sy).toBe(80); // (3+2) * 16
  });
});

describe("screenToTile", () => {
  const tw = 64;
  const th = 32;

  it("converts screen origin back to tile (0,0)", () => {
    const { tileX, tileY } = screenToTile(0, 0, tw, th);
    expect(tileX).toBe(0);
    expect(tileY).toBe(0);
  });

  it("round-trips tile (1, 0)", () => {
    const { sx, sy } = tileToScreen(1, 0, tw, th);
    const { tileX, tileY } = screenToTile(sx, sy, tw, th);
    expect(tileX).toBe(1);
    expect(tileY).toBe(0);
  });

  it("round-trips tile (3, 2)", () => {
    const { sx, sy } = tileToScreen(3, 2, tw, th);
    const { tileX, tileY } = screenToTile(sx, sy, tw, th);
    expect(tileX).toBe(3);
    expect(tileY).toBe(2);
  });

  it("rounds down for points within a tile", () => {
    // Click slightly off-center within tile (1, 0)
    const { sx, sy } = tileToScreen(1, 0, tw, th);
    const { tileX, tileY } = screenToTile(sx + 5, sy + 3, tw, th);
    expect(tileX).toBe(1);
    expect(tileY).toBe(0);
  });
});
