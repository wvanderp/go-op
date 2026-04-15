import type { GameState, TilePos, Unit, UnitAction } from "@go-op/types";

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
  readonly success: boolean;
}

export interface UnitStep {
  readonly type: "unitStep";
  readonly unitId: string;
  readonly from: TilePos;
  readonly to: TilePos;
  readonly durationMs: number;
}

export interface ErrorMessage {
  readonly type: "error";
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Differential State Updates
// ---------------------------------------------------------------------------

export interface UnitDiff {
  readonly unitId: string;
  readonly pos?: TilePos;
  readonly action?: UnitAction;
}

export interface StateDiff {
  readonly type: "stateDiff";
  readonly tick: number;
  readonly unitUpdates: readonly UnitDiff[];
}

export type ServerMessage =
  | StateUpdate
  | MoveResult
  | UnitStep
  | ErrorMessage
  | StateDiff;

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
      typeof obj.success !== "boolean"
    ) {
      throw new Error("MoveResult: missing fields");
    }
    return obj as unknown as MoveResult;
  }

  if (obj.type === "unitStep") {
    const from = obj.from as Record<string, unknown> | undefined;
    const to = obj.to as Record<string, unknown> | undefined;
    if (
      typeof obj.unitId !== "string" ||
      !from ||
      typeof from.x !== "number" ||
      typeof from.y !== "number" ||
      !to ||
      typeof to.x !== "number" ||
      typeof to.y !== "number" ||
      typeof obj.durationMs !== "number"
    ) {
      throw new Error("UnitStep: missing fields");
    }
    return obj as unknown as UnitStep;
  }

  if (obj.type === "error") {
    if (typeof obj.message !== "string") {
      throw new Error("ErrorMessage: missing message");
    }
    return obj as unknown as ErrorMessage;
  }

  if (obj.type === "stateDiff") {
    if (
      typeof obj.tick !== "number" ||
      !Array.isArray(obj.unitUpdates)
    ) {
      throw new Error("StateDiff: missing fields");
    }
    return obj as unknown as StateDiff;
  }

  throw new Error(`Unknown server message type: ${String(obj.type)}`);
}

// ---------------------------------------------------------------------------
// State Diff Utilities
// ---------------------------------------------------------------------------

export function computeStateDiff(
  previousUnits: readonly Unit[],
  currentUnits: readonly Unit[],
  tick: number,
): StateDiff {
  const unitUpdates: UnitDiff[] = [];

  for (const current of currentUnits) {
    const previous = previousUnits.find((u) => u.id === current.id);
    const posChanged =
      !previous ||
      previous.pos.x !== current.pos.x ||
      previous.pos.y !== current.pos.y;
    const actionChanged =
      !previous || previous.action.type !== current.action.type;

    if (posChanged || actionChanged) {
      unitUpdates.push({
        unitId: current.id,
        ...(posChanged ? { pos: current.pos } : {}),
        ...(actionChanged ? { action: current.action } : {}),
      });
    }
  }

  return { type: "stateDiff", tick, unitUpdates };
}

export function applyStateDiff(
  state: GameState,
  diff: StateDiff,
): GameState {
  const units = [...state.units];

  for (const update of diff.unitUpdates) {
    const index = units.findIndex((u) => u.id === update.unitId);
    if (index === -1) continue;

    units[index] = {
      ...units[index]!,
      ...(update.pos !== undefined ? { pos: update.pos } : {}),
      ...(update.action !== undefined ? { action: update.action } : {}),
    };
  }

  return { ...state, units };
}
