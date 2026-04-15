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

function sendMove(ws: WebSocket, unitId: string, x: number, y: number): void {
  ws.send(JSON.stringify({ type: "move", unitId, target: { x, y } }));
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
      expect(msg.state.units).toHaveLength(1);
      expect(msg.state.units[0]!.id).toBe("unit-1");
    }
    client.close();
  });

  it("processes a valid move request", async () => {
    const { ws: client } = await connectClient(server.port);

    // Collect both moveResult and state update atomically
    const msgsPromise = collectMessages(client, 2);
    sendMove(client, "unit-1", 2, 0);

    const [moveResult, stateMsg] = await msgsPromise;

    expect(moveResult!.type).toBe("moveResult");
    if (moveResult!.type === "moveResult") {
      expect(moveResult!.success).toBe(true);
      expect(moveResult!.unitId).toBe("unit-1");
      expect(moveResult!.path.length).toBeGreaterThan(0);
      expect(moveResult!.path[moveResult!.path.length - 1]).toEqual({
        x: 2,
        y: 0,
      });
    }

    expect(stateMsg!.type).toBe("state");
    if (stateMsg!.type === "state") {
      expect(stateMsg!.state.units[0]!.pos).toEqual({ x: 2, y: 0 });
    }

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

    // Collect both moveResult + stateUpdate for each client
    const msgs1Promise = collectMessages(client1, 2);
    const msgs2Promise = collectMessages(client2, 2);

    // Client 1 moves
    sendMove(client1, "unit-1", 1, 0);

    const [msgs1, msgs2] = await Promise.all([msgs1Promise, msgs2Promise]);

    // Both should receive moveResult
    expect(msgs1[0]!.type).toBe("moveResult");
    expect(msgs2[0]!.type).toBe("moveResult");

    // Both should receive state update
    expect(msgs1[1]!.type).toBe("state");
    expect(msgs2[1]!.type).toBe("state");
    if (msgs1[1]!.type === "state" && msgs2[1]!.type === "state") {
      expect(msgs1[1]!.state.units[0]!.pos).toEqual({ x: 1, y: 0 });
      expect(msgs2[1]!.state.units[0]!.pos).toEqual({ x: 1, y: 0 });
    }

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
