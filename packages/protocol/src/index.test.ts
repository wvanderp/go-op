import { describe, it, expect } from "vitest";
import {
  type MoveRequest,
  type StateUpdate,
  type MoveResult,
  type UnitStep,
  type ErrorMessage,
  type StateDiff,
  type ClientMessage,
  type ServerMessage,
  encodeMessage,
  decodeClientMessage,
  decodeServerMessage,
  computeStateDiff,
  applyStateDiff,
} from "@go-op/protocol";
import { TileType, createTilePos } from "@go-op/types";

describe("encodeMessage", () => {
  it("serializes a MoveRequest", () => {
    const msg: MoveRequest = {
      type: "move",
      unitId: "u1",
      target: createTilePos(3, 4),
    };
    const json = encodeMessage(msg);
    expect(JSON.parse(json)).toEqual(msg);
  });

  it("serializes a StateUpdate", () => {
    const msg: StateUpdate = {
      type: "state",
      state: {
        map: { width: 2, height: 2, tiles: [0, 0, 0, 0] },
        units: [{ id: "u1", pos: { x: 1, y: 1 }, speedTilesPerSecond: 1, action: { type: "idle" } }],
      },
    };
    const json = encodeMessage(msg);
    expect(JSON.parse(json)).toEqual(msg);
  });
});

describe("decodeClientMessage", () => {
  it("decodes a valid MoveRequest", () => {
    const msg: MoveRequest = {
      type: "move",
      unitId: "u1",
      target: createTilePos(3, 4),
    };
    const result = decodeClientMessage(JSON.stringify(msg));
    expect(result).toEqual(msg);
  });

  it("throws on invalid JSON", () => {
    expect(() => decodeClientMessage("not json")).toThrow();
  });

  it("throws on unknown message type", () => {
    expect(() =>
      decodeClientMessage(JSON.stringify({ type: "unknown" })),
    ).toThrow();
  });

  it("throws on missing fields", () => {
    expect(() =>
      decodeClientMessage(JSON.stringify({ type: "move" })),
    ).toThrow();
  });

  it("throws on invalid target", () => {
    expect(() =>
      decodeClientMessage(
        JSON.stringify({ type: "move", unitId: "u1", target: "bad" }),
      ),
    ).toThrow();
  });
});

describe("decodeServerMessage", () => {
  it("decodes a StateUpdate", () => {
    const msg: StateUpdate = {
      type: "state",
      state: {
        map: { width: 2, height: 2, tiles: [0, 0, 0, 0] },
        units: [],
      },
    };
    const result = decodeServerMessage(JSON.stringify(msg));
    expect(result).toEqual(msg);
  });

  it("decodes a MoveResult", () => {
    const msg: MoveResult = {
      type: "moveResult",
      unitId: "u1",
      success: true,
    };
    const result = decodeServerMessage(JSON.stringify(msg));
    expect(result).toEqual(msg);
  });

  it("decodes a UnitStep", () => {
    const msg: UnitStep = {
      type: "unitStep",
      unitId: "u1",
      from: createTilePos(0, 0),
      to: createTilePos(1, 0),
      durationMs: 1_000,
    };
    const result = decodeServerMessage(JSON.stringify(msg));
    expect(result).toEqual(msg);
  });

  it("decodes an ErrorMessage", () => {
    const msg: ErrorMessage = {
      type: "error",
      message: "Invalid move",
    };
    const result = decodeServerMessage(JSON.stringify(msg));
    expect(result).toEqual(msg);
  });

  it("throws on invalid JSON", () => {
    expect(() => decodeServerMessage("not json")).toThrow();
  });

  it("throws on unknown message type", () => {
    expect(() =>
      decodeServerMessage(JSON.stringify({ type: "unknown" })),
    ).toThrow();
  });

  it("throws on missing state in StateUpdate", () => {
    expect(() =>
      decodeServerMessage(JSON.stringify({ type: "state" })),
    ).toThrow();
  });

  it("throws on missing fields in MoveResult", () => {
    expect(() =>
      decodeServerMessage(JSON.stringify({ type: "moveResult" })),
    ).toThrow();
  });

  it("throws on missing message in ErrorMessage", () => {
    expect(() =>
      decodeServerMessage(JSON.stringify({ type: "error" })),
    ).toThrow();
  });

  it("throws on missing fields in UnitStep", () => {
    expect(() =>
      decodeServerMessage(JSON.stringify({ type: "unitStep", unitId: "u1" })),
    ).toThrow();
  });

  it("decodes a StateDiff", () => {
    const msg: StateDiff = {
      type: "stateDiff",
      tick: 5,
      unitUpdates: [
        { unitId: "u1", pos: createTilePos(3, 4) },
        { unitId: "u2", action: { type: "idle" } },
      ],
    };
    const result = decodeServerMessage(JSON.stringify(msg));
    expect(result).toEqual(msg);
  });

  it("throws on missing fields in StateDiff", () => {
    expect(() =>
      decodeServerMessage(JSON.stringify({ type: "stateDiff" })),
    ).toThrow();
    expect(() =>
      decodeServerMessage(
        JSON.stringify({ type: "stateDiff", tick: 1 }),
      ),
    ).toThrow();
  });
});

describe("computeStateDiff", () => {
  const unit1 = {
    id: "u1",
    pos: createTilePos(0, 0),
    speedTilesPerSecond: 1,
    action: { type: "idle" as const },
  };
  const unit2 = {
    id: "u2",
    pos: createTilePos(5, 5),
    speedTilesPerSecond: 1,
    action: { type: "idle" as const },
  };

  it("returns empty unitUpdates when nothing changed", () => {
    const diff = computeStateDiff([unit1, unit2], [unit1, unit2], 1);
    expect(diff.type).toBe("stateDiff");
    expect(diff.tick).toBe(1);
    expect(diff.unitUpdates).toEqual([]);
  });

  it("detects position change", () => {
    const moved = { ...unit1, pos: createTilePos(1, 0) };
    const diff = computeStateDiff([unit1, unit2], [moved, unit2], 2);
    expect(diff.unitUpdates).toEqual([
      { unitId: "u1", pos: { x: 1, y: 0 } },
    ]);
  });

  it("detects action change", () => {
    const moving = { ...unit1, action: { type: "moving" as const } };
    const diff = computeStateDiff([unit1], [moving], 3);
    expect(diff.unitUpdates).toEqual([
      { unitId: "u1", action: { type: "moving" } },
    ]);
  });

  it("detects both position and action change", () => {
    const updated = {
      ...unit1,
      pos: createTilePos(2, 3),
      action: { type: "moving" as const },
    };
    const diff = computeStateDiff([unit1], [updated], 4);
    expect(diff.unitUpdates).toHaveLength(1);
    expect(diff.unitUpdates[0]!.pos).toEqual({ x: 2, y: 3 });
    expect(diff.unitUpdates[0]!.action).toEqual({ type: "moving" });
  });

  it("treats a new unit (not in previous) as fully changed", () => {
    const diff = computeStateDiff([], [unit1], 5);
    expect(diff.unitUpdates).toEqual([
      { unitId: "u1", pos: { x: 0, y: 0 }, action: { type: "idle" } },
    ]);
  });

  it("increments tick correctly", () => {
    const diff = computeStateDiff([unit1], [unit1], 42);
    expect(diff.tick).toBe(42);
  });
});

describe("applyStateDiff", () => {
  const baseState = {
    map: { width: 2, height: 2, tiles: [0, 0, 0, 0] as const },
    units: [
      {
        id: "u1",
        pos: createTilePos(0, 0),
        speedTilesPerSecond: 1,
        action: { type: "idle" as const },
      },
      {
        id: "u2",
        pos: createTilePos(5, 5),
        speedTilesPerSecond: 1,
        action: { type: "idle" as const },
      },
    ],
  };

  it("applies a position update", () => {
    const diff: StateDiff = {
      type: "stateDiff",
      tick: 1,
      unitUpdates: [{ unitId: "u1", pos: createTilePos(3, 4) }],
    };
    const result = applyStateDiff(baseState, diff);
    expect(result.units[0]!.pos).toEqual({ x: 3, y: 4 });
    expect(result.units[1]!.pos).toEqual({ x: 5, y: 5 });
  });

  it("applies an action update", () => {
    const diff: StateDiff = {
      type: "stateDiff",
      tick: 1,
      unitUpdates: [{ unitId: "u2", action: { type: "moving" } }],
    };
    const result = applyStateDiff(baseState, diff);
    expect(result.units[1]!.action).toEqual({ type: "moving" });
    expect(result.units[0]!.action).toEqual({ type: "idle" });
  });

  it("applies both position and action updates", () => {
    const diff: StateDiff = {
      type: "stateDiff",
      tick: 1,
      unitUpdates: [
        {
          unitId: "u1",
          pos: createTilePos(1, 1),
          action: { type: "moving" },
        },
      ],
    };
    const result = applyStateDiff(baseState, diff);
    expect(result.units[0]!.pos).toEqual({ x: 1, y: 1 });
    expect(result.units[0]!.action).toEqual({ type: "moving" });
  });

  it("does not modify the original state", () => {
    const diff: StateDiff = {
      type: "stateDiff",
      tick: 1,
      unitUpdates: [{ unitId: "u1", pos: createTilePos(9, 9) }],
    };
    applyStateDiff(baseState, diff);
    expect(baseState.units[0]!.pos).toEqual({ x: 0, y: 0 });
  });

  it("ignores unknown unit IDs", () => {
    const diff: StateDiff = {
      type: "stateDiff",
      tick: 1,
      unitUpdates: [{ unitId: "unknown", pos: createTilePos(1, 1) }],
    };
    const result = applyStateDiff(baseState, diff);
    expect(result.units).toHaveLength(2);
    expect(result.units[0]!.pos).toEqual({ x: 0, y: 0 });
  });

  it("preserves map when applying unit diffs", () => {
    const diff: StateDiff = {
      type: "stateDiff",
      tick: 1,
      unitUpdates: [{ unitId: "u1", pos: createTilePos(1, 0) }],
    };
    const result = applyStateDiff(baseState, diff);
    expect(result.map).toBe(baseState.map);
  });
});
