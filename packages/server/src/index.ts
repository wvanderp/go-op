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
  readonly progressTiles: number;
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
  const tickMs = Math.max(10, options.tickMs ?? DEFAULT_SERVER_TICK_MS);
  const now = options.now ?? (() => Date.now());
  const activeMovements = new Map<string, ActiveMovement>();

  // Mutable game state
  let state: GameState = {
    map: createInitialMap(),
    units: [
      { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1 },
      { id: "unit-2", pos: createTilePos(2, 2), speedTilesPerSecond: 1 },
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

  function updateUnitPosition(
    units: readonly Unit[],
    unitId: string,
    pos: TilePos,
  ): readonly Unit[] {
    return units.map((unit) =>
      unit.id === unitId ? { ...unit, pos } : unit,
    );
  }

  function stepMovements(deltaMs: number): boolean {
    if (activeMovements.size === 0) {
      return false;
    }

    const deltaSeconds = deltaMs / 1000;
    let movedAnyUnit = false;
    let nextUnits = state.units;

    for (const [unitId, movement] of [...activeMovements.entries()]) {
      const unit = state.units.find((entry) => entry.id === unitId)!;
      const speed = Math.max(0, unit.speedTilesPerSecond);

      let progressTiles = movement.progressTiles + speed * deltaSeconds;
      let nextIndex = movement.nextIndex;
      let latestPos: TilePos | null = null;

      while (progressTiles >= 1 && nextIndex < movement.path.length) {
        latestPos = movement.path[nextIndex]!;
        nextIndex += 1;
        progressTiles -= 1;
      }

      if (latestPos) {
        nextUnits = updateUnitPosition(nextUnits, unitId, latestPos);
        movedAnyUnit = true;
      }

      if (nextIndex >= movement.path.length) {
        activeMovements.delete(unitId);
      } else {
        activeMovements.set(unitId, {
          unitId,
          path: movement.path,
          nextIndex,
          progressTiles,
        });
      }
    }

    if (!movedAnyUnit) {
      return false;
    }

    state = { ...state, units: nextUnits };
    return true;
  }

  function startTickLoop(): void {
    lastTickAtMs = now();
    tickTimer = setInterval(() => {
      const current = now();
      const deltaMs = current - lastTickAtMs;
      lastTickAtMs = current;

      if (stepMovements(deltaMs)) {
        broadcast({ type: "state", state });
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

    if (path.length > 1) {
      activeMovements.set(clientMsg.unitId, {
        unitId: clientMsg.unitId,
        path,
        nextIndex: 1,
        progressTiles: 0,
      });
    }

    // Broadcast move result. State is broadcast as movement progresses.
    broadcast({
      type: "moveResult",
      unitId: clientMsg.unitId,
      path,
      success: true,
    });
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
