import type { GameState, TilePos } from "@go-op/types";

// ---------------------------------------------------------------------------
// Client → Server Messages
// ---------------------------------------------------------------------------

export interface MoveRequest {
  readonly type: "move";
  readonly unitId: string;
  readonly target: TilePos;
}

export type ClientMessage = MoveRequest;

// ---------------------------------------------------------------------------
// Server → Client Messages
// ---------------------------------------------------------------------------

export interface StateUpdate {
  readonly type: "state";
  readonly state: GameState;
}

export interface MoveResult {
  readonly type: "moveResult";
  readonly unitId: string;
  readonly path: readonly TilePos[];
  readonly success: boolean;
}

export interface ErrorMessage {
  readonly type: "error";
  readonly message: string;
}

export type ServerMessage = StateUpdate | MoveResult | ErrorMessage;

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function encodeMessage(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

// ---------------------------------------------------------------------------
// Deserialization with Validation
// ---------------------------------------------------------------------------

export function decodeClientMessage(raw: string): ClientMessage {
  const obj = JSON.parse(raw) as Record<string, unknown>;

  if (obj.type === "move") {
    if (typeof obj.unitId !== "string") {
      throw new Error("MoveRequest: missing unitId");
    }
    if (
      !obj.target ||
      typeof obj.target !== "object" ||
      typeof (obj.target as Record<string, unknown>).x !== "number" ||
      typeof (obj.target as Record<string, unknown>).y !== "number"
    ) {
      throw new Error("MoveRequest: invalid target");
    }
    return obj as unknown as MoveRequest;
  }

  throw new Error(`Unknown client message type: ${String(obj.type)}`);
}

export function decodeServerMessage(raw: string): ServerMessage {
  const obj = JSON.parse(raw) as Record<string, unknown>;

  if (obj.type === "state") {
    if (!obj.state || typeof obj.state !== "object") {
      throw new Error("StateUpdate: missing state");
    }
    return obj as unknown as StateUpdate;
  }

  if (obj.type === "moveResult") {
    if (
      typeof obj.unitId !== "string" ||
      !Array.isArray(obj.path) ||
      typeof obj.success !== "boolean"
    ) {
      throw new Error("MoveResult: missing fields");
    }
    return obj as unknown as MoveResult;
  }

  if (obj.type === "error") {
    if (typeof obj.message !== "string") {
      throw new Error("ErrorMessage: missing message");
    }
    return obj as unknown as ErrorMessage;
  }

  throw new Error(`Unknown server message type: ${String(obj.type)}`);
}
