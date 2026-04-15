import { describe, it, expect } from "vitest";
import { createTilePos, type Unit } from "@go-op/types";
import {
  selectUnitByClick,
  selectUnitsByBox,
  normalizeBox,
  unitAtTile,
  unitAtPoint,
  type TileBox,
} from "./selection.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unit(id: string, x: number, y: number): Unit {
  return { id, pos: createTilePos(x, y), speedTilesPerSecond: 1, action: { type: "idle" } };
}

// ---------------------------------------------------------------------------
// selectUnitByClick
// ---------------------------------------------------------------------------

describe("selectUnitByClick", () => {
  it("selects a single unit, replacing previous selection", () => {
    const prev = new Set(["unit-1"]);
    const result = selectUnitByClick("unit-2", prev, false);
    expect(result).toEqual(new Set(["unit-2"]));
  });

  it("clears selection when clicking empty space without shift", () => {
    const prev = new Set(["unit-1"]);
    const result = selectUnitByClick(null, prev, false);
    expect(result).toEqual(new Set());
  });

  it("adds a unit to selection with shift held", () => {
    const prev = new Set(["unit-1"]);
    const result = selectUnitByClick("unit-2", prev, true);
    expect(result).toEqual(new Set(["unit-1", "unit-2"]));
  });

  it("removes an already-selected unit with shift held (toggle)", () => {
    const prev = new Set(["unit-1", "unit-2"]);
    const result = selectUnitByClick("unit-2", prev, true);
    expect(result).toEqual(new Set(["unit-1"]));
  });

  it("keeps selection unchanged when shift-clicking empty space", () => {
    const prev = new Set(["unit-1"]);
    const result = selectUnitByClick(null, prev, true);
    expect(result).toEqual(new Set(["unit-1"]));
  });

  it("returns empty set when clicking nothing with no prior selection", () => {
    const result = selectUnitByClick(null, new Set(), false);
    expect(result).toEqual(new Set());
  });
});

// ---------------------------------------------------------------------------
// normalizeBox
// ---------------------------------------------------------------------------

describe("normalizeBox", () => {
  it("normalizes when start is top-left", () => {
    const box = normalizeBox(createTilePos(1, 2), createTilePos(4, 5));
    expect(box).toEqual({ minX: 1, minY: 2, maxX: 4, maxY: 5 });
  });

  it("normalizes when start is bottom-right", () => {
    const box = normalizeBox(createTilePos(4, 5), createTilePos(1, 2));
    expect(box).toEqual({ minX: 1, minY: 2, maxX: 4, maxY: 5 });
  });

  it("normalizes when start and end are the same tile", () => {
    const box = normalizeBox(createTilePos(3, 3), createTilePos(3, 3));
    expect(box).toEqual({ minX: 3, minY: 3, maxX: 3, maxY: 3 });
  });
});

// ---------------------------------------------------------------------------
// selectUnitsByBox
// ---------------------------------------------------------------------------

describe("selectUnitsByBox", () => {
  const units: readonly Unit[] = [
    unit("a", 1, 1),
    unit("b", 3, 3),
    unit("c", 5, 5),
  ];

  it("selects all units inside the box", () => {
    const box: TileBox = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
    const result = selectUnitsByBox(units, box, new Set(), false);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("selects units exactly on the box boundary", () => {
    const box: TileBox = { minX: 3, minY: 3, maxX: 5, maxY: 5 };
    const result = selectUnitsByBox(units, box, new Set(), false);
    expect(result).toEqual(new Set(["b", "c"]));
  });

  it("returns empty set when no units are in the box", () => {
    const box: TileBox = { minX: 10, minY: 10, maxX: 12, maxY: 12 };
    const result = selectUnitsByBox(units, box, new Set(), false);
    expect(result).toEqual(new Set());
  });

  it("replaces previous selection without shift", () => {
    const box: TileBox = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
    const prev = new Set(["c"]);
    const result = selectUnitsByBox(units, box, prev, false);
    expect(result).toEqual(new Set(["a"]));
  });

  it("unions with previous selection when shift is held", () => {
    const box: TileBox = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
    const prev = new Set(["c"]);
    const result = selectUnitsByBox(units, box, prev, true);
    expect(result).toEqual(new Set(["a", "c"]));
  });
});

// ---------------------------------------------------------------------------
// unitAtTile
// ---------------------------------------------------------------------------

describe("unitAtTile", () => {
  const units: readonly Unit[] = [
    unit("a", 2, 3),
    unit("b", 5, 5),
  ];

  it("returns the id of the unit occupying the tile", () => {
    expect(unitAtTile(units, createTilePos(2, 3))).toBe("a");
  });

  it("returns null when no unit is at the tile", () => {
    expect(unitAtTile(units, createTilePos(0, 0))).toBeNull();
  });
});

describe("unitAtPoint", () => {
  const units: readonly Unit[] = [
    unit("a", 2, 3),
    unit("b", 5, 5),
  ];

  it("returns the nearest unit when clicking near an interpolated position", () => {
    expect(unitAtPoint(units, { x: 2.49, y: 3.02 }, 0.5)).toBe("a");
  });

  it("returns null when no unit is within hit radius", () => {
    expect(unitAtPoint(units, { x: 4.2, y: 3.2 }, 0.5)).toBeNull();
  });
});
