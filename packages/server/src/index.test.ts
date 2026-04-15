import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { createGameServer, type GameServer } from "./index.js";
import { applyStateDiff, type ServerMessage } from "@go-op/protocol";
import type { GameState } from "@go-op/types";

// ---------------------------------------------------------------------------
// Test Client — tracks accumulated state from initial snapshot + diffs
// ---------------------------------------------------------------------------

interface TestClient {
  ws: WebSocket;
  state: GameState;
}

/**
 * Connect to the server and wait for the initial state message.
 * Returns a TestClient whose `state` is kept up-to-date as diffs arrive.
 */
function connectClient(port: number): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("error", reject);
    ws.once("message", (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      if (msg.type !== "state") {
        reject(new Error(`Expected initial state, got ${msg.type}`));
        return;
      }
      resolve({ ws, state: msg.state });
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
  client: TestClient,
  predicate: (state: GameState) => boolean,
  timeoutMs = 4_000,
): Promise<GameState> {
  // Check if current accumulated state already matches
  if (predicate(client.state)) {
    return Promise.resolve(client.state);
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      client.ws.off("message", onMessage);
      reject(new Error("Timed out waiting for matching state"));
    }, timeoutMs);

    const onMessage = (data: unknown) => {
      const msg = JSON.parse(String(data)) as ServerMessage;
      if (msg.type === "stateDiff") {
        client.state = applyStateDiff(client.state, msg);
        if (predicate(client.state)) {
          clearTimeout(timeoutId);
          client.ws.off("message", onMessage);
          resolve(client.state);
        }
      }
    };

    client.ws.on("message", onMessage);
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
    const client = await connectClient(server.port);

    expect(client.state.map.width).toBe(64);
    expect(client.state.map.height).toBe(64);
    expect(client.state.units).toHaveLength(2);
    expect(client.state.units[0]!.id).toBe("unit-1");
    expect(client.state.units[0]!.action).toEqual({ type: "idle" });
    client.ws.close();
  });

  it("does not broadcast state while no units are moving", async () => {
    const client = await connectClient(server.port);

    await waitForNoMessage(client.ws, 120);

    client.ws.close();
  });

  it("processes a valid move request", async () => {
    const client = await connectClient(server.port);

    const moveResultPromise = waitForMessageType(client.ws, "moveResult");
    const firstStepPromise = waitForMessageType(client.ws, "unitStep");

    const startedAt = Date.now();
    sendMove(client.ws, "unit-1", 2, 0);

    const moveResult = await moveResultPromise;

    expect(moveResult.type).toBe("moveResult");
    if (moveResult.type === "moveResult") {
      expect(moveResult.success).toBe(true);
      expect(moveResult.unitId).toBe("unit-1");
    }

    const firstStep = await firstStepPromise;
    expect(firstStep.unitId).toBe("unit-1");
    expect(firstStep.from).toEqual({ x: 0, y: 0 });
    expect(firstStep.to).toEqual({ x: 1, y: 0 });
    expect(firstStep.durationMs).toBe(1_000);

    const secondStep = await waitForMessageType(client.ws, "unitStep");
    expect(secondStep.unitId).toBe("unit-1");
    expect(secondStep.from).toEqual({ x: 1, y: 0 });
    expect(secondStep.to).toEqual({ x: 2, y: 0 });
    expect(secondStep.durationMs).toBe(1_000);

    const finalState = await waitForStateWhere(
      client,
      (s) => s.units[0]!.pos.x === 2 && s.units[0]!.pos.y === 0,
      3_500,
    );
    expect(finalState.units[0]!.pos).toEqual({ x: 2, y: 0 });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_500);

    client.ws.close();
  });

  it("sets action to moving while unit travels and idle when it arrives", async () => {
    const client = await connectClient(server.port);

    sendMove(client.ws, "unit-1", 3, 0);
    await waitForMessageType(client.ws, "moveResult");

    // While moving, action should be "moving"
    const movingState = await waitForStateWhere(
      client,
      (s) => s.units[0]!.action.type === "moving",
      2_000,
    );
    expect(movingState.units[0]!.action).toEqual({ type: "moving" });

    // After arriving, action should be "idle"
    const idleState = await waitForStateWhere(
      client,
      (s) => s.units[0]!.action.type === "idle" && s.units[0]!.pos.x === 3,
      5_000,
    );
    expect(idleState.units[0]!.action).toEqual({ type: "idle" });
    expect(idleState.units[0]!.pos).toEqual({ x: 3, y: 0 });

    client.ws.close();
  });

  it("redirects a moving unit from its current tile to the new target", async () => {
    const client = await connectClient(server.port);

    // Move unit-1 to (5, 0) — a long path
    sendMove(client.ws, "unit-1", 5, 0);
    const firstResult = await waitForMessageType(client.ws, "moveResult");
    expect(firstResult.success).toBe(true);

    // Wait until unit reaches tile (1, 0) — it's en route
    await waitForStateWhere(
      client,
      (s) => s.units[0]!.pos.x >= 1 && s.units[0]!.pos.y === 0,
      3_000,
    );

    // Now redirect to (1, 3) while unit is mid-path
    sendMove(client.ws, "unit-1", 1, 3);
    const secondResult = await waitForMessageType(client.ws, "moveResult");
    expect(secondResult.success).toBe(true);

    // Unit should eventually arrive at the new target
    const finalState = await waitForStateWhere(
      client,
      (s) => s.units[0]!.pos.x === 1 && s.units[0]!.pos.y === 3,
      8_000,
    );
    expect(finalState.units[0]!.pos).toEqual({ x: 1, y: 3 });
    expect(finalState.units[0]!.action).toEqual({ type: "idle" });

    client.ws.close();
  });

  it("returns a successful moveResult for same-tile moves without state broadcast", async () => {
    const client = await connectClient(server.port);

    sendMove(client.ws, "unit-1", 0, 0);

    const moveResult = await waitForMessageType(client.ws, "moveResult");
    expect(moveResult.success).toBe(true);

    await waitForNoMessage(client.ws, 120);

    client.ws.close();
  });

  it("sends error for unknown unit", async () => {
    const client = await connectClient(server.port);

    const msgPromise = waitForMessage(client.ws);
    sendMove(client.ws, "nonexistent", 1, 1);

    const msg = await msgPromise;
    expect(msg.type).toBe("error");
    if (msg.type === "error") {
      expect(msg.message).toContain("nonexistent");
    }

    client.ws.close();
  });

  it("sends error for move to blocked tile", async () => {
    const client = await connectClient(server.port);

    const msgPromise = waitForMessage(client.ws);
    sendMove(client.ws, "unit-1", -1, -1);

    const msg = await msgPromise;
    expect(msg.type).toBe("error");

    client.ws.close();
  });

  it("broadcasts state to all connected clients", async () => {
    const client1 = await connectClient(server.port);
    const client2 = await connectClient(server.port);

    const moveResult1Promise = waitForMessageType(client1.ws, "moveResult");
    const moveResult2Promise = waitForMessageType(client2.ws, "moveResult");
    const step1Promise = waitForMessageType(client1.ws, "unitStep");
    const step2Promise = waitForMessageType(client2.ws, "unitStep");

    // Client 1 moves
    sendMove(client1.ws, "unit-1", 1, 0);

    const [moveResult1, moveResult2] = await Promise.all([
      moveResult1Promise,
      moveResult2Promise,
    ]);

    expect(moveResult1.unitId).toBe("unit-1");
    expect(moveResult2.unitId).toBe("unit-1");

    const [step1, step2] = await Promise.all([
      step1Promise,
      step2Promise,
    ]);
    expect(step1.unitId).toBe("unit-1");
    expect(step2.unitId).toBe("unit-1");

    const [state1, state2] = await Promise.all([
      waitForStateWhere(
        client1,
        (s) => s.units[0]!.pos.x === 1 && s.units[0]!.pos.y === 0,
      ),
      waitForStateWhere(
        client2,
        (s) => s.units[0]!.pos.x === 1 && s.units[0]!.pos.y === 0,
      ),
    ]);

    expect(state1.units[0]!.pos).toEqual({ x: 1, y: 0 });
    expect(state2.units[0]!.pos).toEqual({ x: 1, y: 0 });

    client1.ws.close();
    client2.ws.close();
  });

  it("handles invalid JSON gracefully", async () => {
    const client = await connectClient(server.port);

    const msgPromise = waitForMessage(client.ws);
    client.ws.send("not valid json");

    const msg = await msgPromise;
    expect(msg.type).toBe("error");

    client.ws.close();
  });

  it("stop is safe to call without start", async () => {
    const unstartedServer = createGameServer(0);
    await unstartedServer.stop(); // should not throw
  });
});

describe("GameServer differential updates", () => {
  let server: GameServer;

  beforeEach(async () => {
    server = createGameServer(0);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("sends stateDiff messages instead of full state during ticks", async () => {
    const client = await connectClient(server.port);

    sendMove(client.ws, "unit-1", 1, 0);
    await waitForMessageType(client.ws, "moveResult");

    // The next state update should be a stateDiff, not a full state
    const diff = await waitForMessageType(client.ws, "stateDiff");
    expect(diff.type).toBe("stateDiff");
    expect(diff.tick).toBeGreaterThan(0);
    expect(Array.isArray(diff.unitUpdates)).toBe(true);

    client.ws.close();
  });

  it("includes tick counter that increments", async () => {
    const client = await connectClient(server.port);

    sendMove(client.ws, "unit-1", 3, 0);
    await waitForMessageType(client.ws, "moveResult");

    const diff1 = await waitForMessageType(client.ws, "stateDiff");
    const diff2 = await waitForMessageType(client.ws, "stateDiff");

    expect(diff2.tick).toBeGreaterThan(diff1.tick);

    client.ws.close();
  });

  it("only includes changed units in the diff", async () => {
    const client = await connectClient(server.port);

    // Move only unit-1; unit-2 should not appear in diffs
    sendMove(client.ws, "unit-1", 1, 0);
    await waitForMessageType(client.ws, "moveResult");

    // Wait for a diff that contains unit-1's position change
    const diff = await waitForMessageType(client.ws, "stateDiff");
    const unit1Update = diff.unitUpdates.find(
      (u: { unitId: string }) => u.unitId === "unit-1",
    );
    const unit2Update = diff.unitUpdates.find(
      (u: { unitId: string }) => u.unitId === "unit-2",
    );

    expect(unit1Update).toBeDefined();
    expect(unit2Update).toBeUndefined();

    client.ws.close();
  });

  it("diff includes action change to moving on first tick after move request", async () => {
    const client = await connectClient(server.port);

    sendMove(client.ws, "unit-1", 2, 0);
    await waitForMessageType(client.ws, "moveResult");

    // First diff should include action change to "moving"
    const diff = await waitForMessageType(client.ws, "stateDiff");
    const unit1Update = diff.unitUpdates.find(
      (u: { unitId: string }) => u.unitId === "unit-1",
    );
    expect(unit1Update).toBeDefined();
    expect(unit1Update!.action).toEqual({ type: "moving" });

    client.ws.close();
  });

  it("diff includes action change to idle when unit arrives", async () => {
    const client = await connectClient(server.port);

    sendMove(client.ws, "unit-1", 1, 0);
    await waitForMessageType(client.ws, "moveResult");

    // Wait for unit to arrive (action becomes idle)
    const finalState = await waitForStateWhere(
      client,
      (s) => s.units[0]!.action.type === "idle" && s.units[0]!.pos.x === 1,
      3_000,
    );
    expect(finalState.units[0]!.action).toEqual({ type: "idle" });
    expect(finalState.units[0]!.pos).toEqual({ x: 1, y: 0 });

    client.ws.close();
  });

  it("does not broadcast diffs when no entities change", async () => {
    const client = await connectClient(server.port);

    // No movement requested — should not see any stateDiff
    await waitForNoMessage(client.ws, 120);

    client.ws.close();
  });
});

describe("GameServer movement timing", () => {
  it("advances at most one tile per tick even after a large elapsed delta", async () => {
    let currentNowMs = 0;
    const server = createGameServer(0, {
      tickMs: 10,
      now: () => currentNowMs,
    });
    await server.start();

    const client = await connectClient(server.port);

    const moveResultPromise = waitForMessageType(client.ws, "moveResult");
    const firstStepPromise = waitForMessageType(client.ws, "unitStep");

    sendMove(client.ws, "unit-1", 3, 0);
    await moveResultPromise;
    await firstStepPromise;

    // Simulate a large server time jump. The unit should not teleport to
    // the destination in a single tick.
    currentNowMs += 5_000;

    const finalState = await waitForStateWhere(
      client,
      (s) => s.units[0]!.pos.x > 0,
      1_500,
    );
    expect(finalState.units[0]!.pos).toEqual({ x: 1, y: 0 });

    client.ws.close();
    await server.stop();
  });
});
