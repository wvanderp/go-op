import { describe, it, expect } from "vitest";
import {
  type MoveRequest,
  type StateUpdate,
  type MoveResult,
  type ErrorMessage,
  type ClientMessage,
  type ServerMessage,
  encodeMessage,
  decodeClientMessage,
  decodeServerMessage,
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
        units: [{ id: "u1", pos: { x: 1, y: 1 } }],
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
      path: [createTilePos(0, 0), createTilePos(1, 0)],
      success: true,
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
});
