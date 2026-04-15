import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { createGameServer, type GameServer } from "@go-op/server";
import type { ServerMessage } from "@go-op/protocol";

/**
 * Connect to the server and wait for the initial state message.
 * Registers message handler BEFORE the connection opens to avoid
 * a race where the server sends the initial state before we listen.
 */
function connectClient(
  port: number,
): Promise<{ ws: WebSocket; initialState: ServerMessage }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("error", reject);
    ws.once("message", (data) => {
      resolve({
        ws,
        initialState: JSON.parse(data.toString()) as ServerMessage,
      });
    });
  });
}

/**
 * Collect the next N messages from a WebSocket.
 * Registers listener before returning, so no messages can be missed
 * between consecutive calls if you await the returned promise atomically.
 */
function collectMessages(
  ws: WebSocket,
  count: number,
): Promise<ServerMessage[]> {
  return new Promise((resolve) => {
    const msgs: ServerMessage[] = [];
    const handler = (data: unknown) => {
      msgs.push(JSON.parse(String(data)) as ServerMessage);
      if (msgs.length === count) {
        ws.off("message", handler);
        resolve(msgs);
      }
    };
    ws.on("message", handler);
  });
}

function waitForMessage(ws: WebSocket): Promise<ServerMessage> {
  return collectMessages(ws, 1).then((msgs) => msgs[0]!);
}

function waitForMessageType<TType extends ServerMessage["type"]>(
  ws: WebSocket,
  type: TType,
  timeoutMs = 4_000,
): Promise<Extract<ServerMessage, { type: TType }>> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error(`Timed out waiting for message type: ${type}`));
    }, timeoutMs);

    const onMessage = (data: unknown) => {
      const msg = JSON.parse(String(data)) as ServerMessage;
      if (msg.type !== type) {
        return;
      }
      clearTimeout(timeoutId);
      ws.off("message", onMessage);
      resolve(msg as Extract<ServerMessage, { type: TType }>);
    };

    ws.on("message", onMessage);
  });
}

function waitForStateWhere(
  ws: WebSocket,
  predicate: (msg: Extract<ServerMessage, { type: "state" }>) => boolean,
  timeoutMs = 4_000,
): Promise<Extract<ServerMessage, { type: "state" }>> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("Timed out waiting for matching state message"));
    }, timeoutMs);

    const onMessage = (data: unknown) => {
      const msg = JSON.parse(String(data)) as ServerMessage;
      if (msg.type !== "state") {
        return;
      }

      if (!predicate(msg)) {
        return;
      }

      clearTimeout(timeoutId);
      ws.off("message", onMessage);
      resolve(msg);
    };

    ws.on("message", onMessage);
  });
}

function sendMove(ws: WebSocket, unitId: string, x: number, y: number): void {
  ws.send(JSON.stringify({ type: "move", unitId, target: { x, y } }));
}

function waitForNoMessage(ws: WebSocket, windowMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onMessage = () => {
      clearTimeout(timerId);
      ws.off("message", onMessage);
      reject(new Error("Received an unexpected message"));
    };

    const timerId = setTimeout(() => {
      ws.off("message", onMessage);
      resolve();
    }, windowMs);

    ws.on("message", onMessage);
  });
}

describe("GameServer", () => {
  let server: GameServer;

  beforeEach(async () => {
    server = createGameServer(0);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("sends initial state on client connect", async () => {
    const { ws: client, initialState: msg } = await connectClient(server.port);

    expect(msg.type).toBe("state");
    if (msg.type === "state") {
      expect(msg.state.map.width).toBe(64);
      expect(msg.state.map.height).toBe(64);
      expect(msg.state.units).toHaveLength(2);
      expect(msg.state.units[0]!.id).toBe("unit-1");
    }
    client.close();
  });

  it("does not broadcast state while no units are moving", async () => {
    const { ws: client } = await connectClient(server.port);

    await waitForNoMessage(client, 120);

    client.close();
  });

  it("processes a valid move request", async () => {
    const { ws: client } = await connectClient(server.port);

    const startedAt = Date.now();
    sendMove(client, "unit-1", 2, 0);

    const moveResult = await waitForMessageType(client, "moveResult");

    expect(moveResult.type).toBe("moveResult");
    if (moveResult.type === "moveResult") {
      expect(moveResult.success).toBe(true);
      expect(moveResult.unitId).toBe("unit-1");
      expect(moveResult.path.length).toBeGreaterThan(0);
      expect(moveResult.path[moveResult.path.length - 1]).toEqual({
        x: 2,
        y: 0,
      });
    }

    const intermediateState = await waitForStateWhere(
      client,
      (msg) =>
        msg.state.units[0]!.pos.x === 1 && msg.state.units[0]!.pos.y === 0,
      2_500,
    );
    expect(intermediateState.state.units[0]!.pos).toEqual({ x: 1, y: 0 });

    const finalState = await waitForStateWhere(
      client,
      (msg) =>
        msg.state.units[0]!.pos.x === 2 && msg.state.units[0]!.pos.y === 0,
      3_500,
    );
    expect(finalState.state.units[0]!.pos).toEqual({ x: 2, y: 0 });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_500);

    client.close();
  });

  it("returns a successful moveResult for same-tile moves without state broadcast", async () => {
    const { ws: client } = await connectClient(server.port);

    sendMove(client, "unit-1", 0, 0);

    const moveResult = await waitForMessageType(client, "moveResult");
    expect(moveResult.success).toBe(true);
    expect(moveResult.path).toEqual([{ x: 0, y: 0 }]);

    await waitForNoMessage(client, 120);

    client.close();
  });

  it("sends error for unknown unit", async () => {
    const { ws: client } = await connectClient(server.port);

    const msgPromise = waitForMessage(client);
    sendMove(client, "nonexistent", 1, 1);

    const msg = await msgPromise;
    expect(msg.type).toBe("error");
    if (msg.type === "error") {
      expect(msg.message).toContain("nonexistent");
    }

    client.close();
  });

  it("sends error for move to blocked tile", async () => {
    const { ws: client } = await connectClient(server.port);

    const msgPromise = waitForMessage(client);
    sendMove(client, "unit-1", -1, -1);

    const msg = await msgPromise;
    expect(msg.type).toBe("error");

    client.close();
  });

  it("broadcasts state to all connected clients", async () => {
    const { ws: client1 } = await connectClient(server.port);
    const { ws: client2 } = await connectClient(server.port);

    // Client 1 moves
    sendMove(client1, "unit-1", 1, 0);

    const [moveResult1, moveResult2] = await Promise.all([
      waitForMessageType(client1, "moveResult"),
      waitForMessageType(client2, "moveResult"),
    ]);

    expect(moveResult1.unitId).toBe("unit-1");
    expect(moveResult2.unitId).toBe("unit-1");

    const [state1, state2] = await Promise.all([
      waitForStateWhere(
        client1,
        (msg) => msg.state.units[0]!.pos.x === 1 && msg.state.units[0]!.pos.y === 0,
      ),
      waitForStateWhere(
        client2,
        (msg) => msg.state.units[0]!.pos.x === 1 && msg.state.units[0]!.pos.y === 0,
      ),
    ]);

    expect(state1.state.units[0]!.pos).toEqual({ x: 1, y: 0 });
    expect(state2.state.units[0]!.pos).toEqual({ x: 1, y: 0 });

    client1.close();
    client2.close();
  });

  it("handles invalid JSON gracefully", async () => {
    const { ws: client } = await connectClient(server.port);

    const msgPromise = waitForMessage(client);
    client.send("not valid json");

    const msg = await msgPromise;
    expect(msg.type).toBe("error");

    client.close();
  });

  it("stop is safe to call without start", async () => {
    const unstartedServer = createGameServer(0);
    await unstartedServer.stop(); // should not throw
  });
});
