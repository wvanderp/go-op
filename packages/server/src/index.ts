import { WebSocketServer, WebSocket } from "ws";
import { createMap, setTile, findPath } from "@go-op/map";
import {
  type TileMap,
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

export function createGameServer(port: number): GameServer {
  let wss: WebSocketServer | null = null;
  let actualPort = port;

  // Mutable game state
  let state: GameState = {
    map: createInitialMap(),
    units: [{ id: "unit-1", pos: createTilePos(0, 0) }],
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

    // Update unit position to destination
    const destination = path[path.length - 1]!;
    const unitIdx = state.units.findIndex((u) => u.id === clientMsg.unitId);
    const updatedUnits = [...state.units];
    updatedUnits[unitIdx] = { ...updatedUnits[unitIdx]!, pos: destination };
    state = { ...state, units: updatedUnits };

    // Broadcast move result and updated state
    broadcast({
      type: "moveResult",
      unitId: clientMsg.unitId,
      path,
      success: true,
    });
    broadcast({ type: "state", state });
  }

  return {
    get port() {
      return actualPort;
    },
    start() {
      return new Promise<void>((resolve) => {
        wss = new WebSocketServer({ port });

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
