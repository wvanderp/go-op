import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { screenToTile } from "@go-op/map";
import type { GameState, TilePos } from "@go-op/types";
import type { ServerMessage } from "@go-op/protocol";
import {
  createGameSceneRenderer,
  type GameSceneRenderer,
} from "./renderer.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const WS_URL = `ws://${window.location.hostname}:9000`;
const UNIT_LABEL_STYLE = new TextStyle({
  fontSize: 10,
  fill: 0xffffff,
  fontFamily: "monospace",
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let gameState: GameState | null = null;
let ws: WebSocket | null = null;
let lastPath: TilePos[] | null = null;
let sceneRenderer: GameSceneRenderer | null = null;

// Camera (pan offset)
let cameraX = 0;
let cameraY = 0;

// ---------------------------------------------------------------------------
// PixiJS Setup
// ---------------------------------------------------------------------------

const app = new Application();
const statusEl = document.getElementById("status")!;

async function init(): Promise<void> {
  await app.init({
    resizeTo: window,
    background: 0x1a1a2e,
    antialias: true,
  });
  document.body.appendChild(app.canvas);

  // Center camera on the map
  cameraX = app.screen.width / 2;
  cameraY = -TILE_HEIGHT * 10; // slightly above center

  sceneRenderer = createGameSceneRenderer({
    stage: app.stage,
    factory: {
      createContainer: () => new Container(),
      createGraphics: () => new Graphics(),
      createLabel: (text) =>
        new Text({
          text,
          style: UNIT_LABEL_STYLE,
        }),
    },
    tileWidth: TILE_WIDTH,
    tileHeight: TILE_HEIGHT,
  });
  sceneRenderer.setCamera(cameraX, cameraY);

  const cleanupInput = setupInput();
  const cleanupSocket = connectToServer();

  let disposed = false;
  const dispose = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    cleanupInput();
    cleanupSocket();
    sceneRenderer?.destroy();
    sceneRenderer = null;
  };

  window.addEventListener("beforeunload", dispose, { once: true });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function syncScene(): void {
  if (!gameState || !sceneRenderer) {
    return;
  }

  sceneRenderer.sync(gameState, lastPath);
}

// ---------------------------------------------------------------------------
// Input Handling
// ---------------------------------------------------------------------------

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragCameraStartX = 0;
let dragCameraStartY = 0;

function setupInput(): () => void {
  const canvas = app.canvas;

  const onPointerDown = (e: PointerEvent): void => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragCameraStartX = cameraX;
    dragCameraStartY = cameraY;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!isDragging) return;
    cameraX = dragCameraStartX + (e.clientX - dragStartX);
    cameraY = dragCameraStartY + (e.clientY - dragStartY);
    sceneRenderer?.setCamera(cameraX, cameraY);
  };

  const onPointerUp = (e: PointerEvent): void => {
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);
    isDragging = false;

    // If the pointer barely moved, treat as a click
    if (dx < 5 && dy < 5) {
      handleClick(e.clientX, e.clientY);
    }
  };

  // Prevent context menu
  const onContextMenu = (e: MouseEvent): void => e.preventDefault();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("contextmenu", onContextMenu);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("contextmenu", onContextMenu);
  };
}

function handleClick(screenX: number, screenY: number): void {
  if (!gameState || !ws) return;

  // Convert screen coords to world coords
  const worldX = screenX - cameraX;
  const worldY = screenY - cameraY;

  // Convert to tile coords
  const { tileX, tileY } = screenToTile(
    worldX,
    worldY,
    TILE_WIDTH,
    TILE_HEIGHT,
  );

  // Check bounds
  if (
    tileX < 0 ||
    tileX >= gameState.map.width ||
    tileY < 0 ||
    tileY >= gameState.map.height
  ) {
    return;
  }

  // Send move request for the first unit
  const unit = gameState.units[0];
  if (!unit) return;

  const msg = JSON.stringify({
    type: "move",
    unitId: unit.id,
    target: { x: tileX, y: tileY },
  });
  ws.send(msg);

  statusEl.textContent = `Moving ${unit.id} to (${tileX}, ${tileY})…`;
}

// ---------------------------------------------------------------------------
// WebSocket Connection
// ---------------------------------------------------------------------------

function connectToServer(): () => void {
  const socket = new WebSocket(WS_URL);
  ws = socket;

  const onOpen = (): void => {
    statusEl.textContent = "Connected — click a tile to move the unit";
  };

  const onMessage = (event: MessageEvent): void => {
    const msg = JSON.parse(event.data as string) as ServerMessage;

    if (msg.type === "state") {
      gameState = msg.state;
      syncScene();
    } else if (msg.type === "moveResult") {
      if (msg.success) {
        lastPath = [...msg.path];
        statusEl.textContent = `Moved to (${msg.path[msg.path.length - 1]!.x}, ${msg.path[msg.path.length - 1]!.y})`;
        syncScene();
      } else {
        statusEl.textContent = "Move failed!";
      }
    } else if (msg.type === "error") {
      statusEl.textContent = `Error: ${msg.message}`;
    }
  };

  const onClose = (): void => {
    if (ws === socket) {
      ws = null;
    }
    statusEl.textContent = "Disconnected — refresh to reconnect";
  };

  const onError = (): void => {
    statusEl.textContent = "Connection error — is the server running?";
  };

  socket.addEventListener("open", onOpen);
  socket.addEventListener("message", onMessage);
  socket.addEventListener("close", onClose);
  socket.addEventListener("error", onError);

  return () => {
    socket.removeEventListener("open", onOpen);
    socket.removeEventListener("message", onMessage);
    socket.removeEventListener("close", onClose);
    socket.removeEventListener("error", onError);

    if (ws === socket) {
      ws = null;
    }

    socket.close();
  };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

init();
