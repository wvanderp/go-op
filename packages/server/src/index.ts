import { WebSocketServer, WebSocket } from "ws";
import { createMap, setTile, findPath } from "@go-op/map";
import {
  type TileMap,
  type TilePos,
  type Unit,
  type GameState,
  TileType,
  createTilePos,
} from "@go-op/types";
import {
  encodeMessage,
  decodeClientMessage,
  computeStateDiff,
  type ServerMessage,
} from "@go-op/protocol";

// ---------------------------------------------------------------------------
// Game Server
// ---------------------------------------------------------------------------

export interface GameServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly port: number;
}

interface ActiveMovement {
  readonly unitId: string;
  readonly path: readonly TilePos[];
  readonly nextIndex: number;
  readonly elapsedMs: number;
}

interface CreateGameServerOptions {
  readonly tickMs?: number;
  readonly now?: () => number;
}

const DEFAULT_SERVER_TICK_MS = 50;

function createInitialMap(): TileMap {
  let map = createMap(64, 64);

  // Seed some blocked tiles for A* demo — a few walls
  for (let y = 5; y < 20; y++) {
    map = setTile(map, 10, y, TileType.Blocked);
  }
  for (let x = 20; x < 35; x++) {
    map = setTile(map, x, 30, TileType.Blocked);
  }
  for (let y = 15; y < 40; y++) {
    map = setTile(map, 40, y, TileType.Blocked);
  }

  return map;
}

export function createGameServer(
  port: number,
  options: CreateGameServerOptions = {},
): GameServer {
  let wss: WebSocketServer | null = null;
  let actualPort = port;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let lastTickAtMs = 0;
  let tickCount = 0;
  let previousTickUnits: readonly Unit[] = [];
  const tickMs = Math.max(10, options.tickMs ?? DEFAULT_SERVER_TICK_MS);
  const now = options.now ?? (() => Date.now());
  const activeMovements = new Map<string, ActiveMovement>();

  // Mutable game state
  let state: GameState = {
    map: createInitialMap(),
    units: [
      { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1, action: { type: "idle" } },
      { id: "unit-2", pos: createTilePos(2, 2), speedTilesPerSecond: 1, action: { type: "idle" } },
    ],
  };

  function broadcast(msg: ServerMessage): void {
    const data = encodeMessage(msg);
    for (const client of wss!.clients) {
      client.send(data);
    }
  }

  function sendTo(ws: WebSocket, msg: ServerMessage): void {
    ws.send(encodeMessage(msg));
  }

  function updateUnit(
    units: readonly Unit[],
    unitId: string,
    updates: Partial<Pick<Unit, "pos" | "action">>,
  ): readonly Unit[] {
    return units.map((unit) =>
      unit.id === unitId ? { ...unit, ...updates } : unit,
    );
  }

  function tickEntities(deltaMs: number): void {
    const clampedDeltaMs = Math.max(0, deltaMs);
    let nextUnits = state.units;

    for (const unit of state.units) {
      const movement = activeMovements.get(unit.id);
      if (!movement) {
        // Idle entity — visited but no changes this tick
        continue;
      }

      const speed = Math.max(0, unit.speedTilesPerSecond);
      const durationMs = Math.max(1, Math.round(1000 / Math.max(speed, 0.001)));

      const stepDurationMs = durationMs;
      let elapsedMs = movement.elapsedMs + clampedDeltaMs;
      let nextIndex = movement.nextIndex;
      let latestPos: TilePos | null = null;

      if (elapsedMs >= stepDurationMs && nextIndex < movement.path.length) {
        latestPos = movement.path[nextIndex]!;
        nextIndex += 1;
        // Reset elapsed time after each committed tile step so units cannot
        // skip multiple tiles instantly due to one large server delta.
        elapsedMs = 0;

        if (nextIndex < movement.path.length) {
          broadcast({
            type: "unitStep",
            unitId: unit.id,
            from: movement.path[nextIndex - 1]!,
            to: movement.path[nextIndex]!,
            durationMs,
          });
        }
      }

      if (latestPos) {
        nextUnits = updateUnit(nextUnits, unit.id, { pos: latestPos });
      }

      if (nextIndex >= movement.path.length) {
        activeMovements.delete(unit.id);
        nextUnits = updateUnit(nextUnits, unit.id, { action: { type: "idle" } });
      } else {
        activeMovements.set(unit.id, {
          unitId: unit.id,
          path: movement.path,
          nextIndex,
          elapsedMs,
        });
      }
    }

    state = { ...state, units: nextUnits };
  }

  function startTickLoop(): void {
    lastTickAtMs = now();
    previousTickUnits = state.units;
    tickTimer = setInterval(() => {
      const current = now();
      const deltaMs = current - lastTickAtMs;
      lastTickAtMs = current;
      tickCount += 1;

      const snapshotBefore = previousTickUnits;
      tickEntities(deltaMs);
      previousTickUnits = state.units;

      const diff = computeStateDiff(snapshotBefore, state.units, tickCount);
      if (diff.unitUpdates.length > 0) {
        broadcast(diff);
      }
    }, tickMs);
  }

  function stopTickLoop(): void {
    if (!tickTimer) {
      return;
    }

    clearInterval(tickTimer);
    tickTimer = null;
  }

  function handleMessage(ws: WebSocket, raw: string): void {
    let clientMsg;
    try {
      clientMsg = decodeClientMessage(raw);
    } catch {
      sendTo(ws, { type: "error", message: "Invalid message format" });
      return;
    }

    const unit = state.units.find((u) => u.id === clientMsg.unitId);
    if (!unit) {
      sendTo(ws, {
        type: "error",
        message: `Unit not found: ${clientMsg.unitId}`,
      });
      return;
    }

    const path = findPath(state.map, unit.pos, clientMsg.target);
    if (!path) {
      sendTo(ws, {
        type: "error",
        message: `No valid path to (${clientMsg.target.x}, ${clientMsg.target.y})`,
      });
      return;
    }

    let firstStep: Extract<ServerMessage, { type: "unitStep" }> | null = null;

    if (path.length > 1) {
      const speed = Math.max(0, unit.speedTilesPerSecond);
      const durationMs = Math.max(1, Math.round(1000 / Math.max(speed, 0.001)));
      activeMovements.set(clientMsg.unitId, {
        unitId: clientMsg.unitId,
        path,
        nextIndex: 1,
        elapsedMs: 0,
      });
      state = {
        ...state,
        units: updateUnit(state.units, clientMsg.unitId, {
          action: { type: "moving" },
        }),
      };

      firstStep = {
        type: "unitStep",
        unitId: clientMsg.unitId,
        from: path[0]!,
        to: path[1]!,
        durationMs,
      };
    }

    // Broadcast move result. State is broadcast as movement progresses.
    broadcast({
      type: "moveResult",
      unitId: clientMsg.unitId,
      success: true,
    });

    if (firstStep) {
      broadcast(firstStep);
    }
  }

  return {
    get port() {
      return actualPort;
    },
    start() {
      return new Promise<void>((resolve) => {
        wss = new WebSocketServer({ port });
        startTickLoop();

        wss.on("connection", (ws) => {
          // Send current state to new client
          sendTo(ws, { type: "state", state });

          ws.on("message", (data) => {
            handleMessage(ws, data.toString());
          });
        });

        wss.on("listening", () => {
          actualPort = (wss!.address() as { port: number }).port;
          resolve();
        });
      });
    },

    stop() {
      return new Promise<void>((resolve) => {
        stopTickLoop();

        if (!wss) {
          resolve();
          return;
        }
        // Close all connected clients
        for (const client of wss.clients) {
          client.close();
        }
        wss.close(() => {
          wss = null;
          resolve();
        });
      });
    },
  };
}
