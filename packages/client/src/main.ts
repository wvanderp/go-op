import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { screenToTile } from "@go-op/map";
import type { GameState, TilePos, Unit } from "@go-op/types";
import { decodeServerMessage, applyStateDiff, type ServerMessage } from "@go-op/protocol";
import {
  createGameSceneRenderer,
  type GameSceneRenderer,
} from "./renderer.js";
import {
  createUnitPathAnimation,
  sampleUnitPathAnimation,
  type UnitPathAnimation,
} from "./movement-animation.js";
import {
  selectUnitByClick,
  selectUnitsByBox,
  normalizeBox,
  unitAtPoint,
  type TileBox,
} from "./selection.js";

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
const UNIT_SELECTION_HIT_RADIUS_TILES = 0.5;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let gameState: GameState | null = null;
let ws: WebSocket | null = null;
let lastPath: TilePos[] | null = null;
let sceneRenderer: GameSceneRenderer | null = null;
const unitAnimations = new Map<string, UnitPathAnimation>();

// Camera (pan offset)
let cameraX = 0;
let cameraY = 0;

// Selection
let selectedUnitIds = new Set<string>();
let selectionBox: TileBox | null = null;

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

  const onTick = (): void => {
    renderFrame(performance.now());
  };
  app.ticker.add(onTick);

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
    app.ticker.remove(onTick);
    sceneRenderer?.destroy();
    sceneRenderer = null;
  };

  window.addEventListener("beforeunload", dispose, { once: true });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function syncScene(): void {
  renderFrame(performance.now());
}

function getRenderableUnits(nowMs: number): readonly Unit[] {
  if (!gameState) {
    return [];
  }

  return gameState.units.map((unit) => {
    const animation = unitAnimations.get(unit.id);
    if (!animation) {
      return unit;
    }

    const sample = sampleUnitPathAnimation(animation, nowMs);
    return {
      ...unit,
      pos: sample.pos,
    };
  });
}

function reconcileAnimationsWithState(state: GameState): void {
  for (const unit of state.units) {
    const animation = unitAnimations.get(unit.id);
    if (!animation) {
      continue;
    }

    const destination = animation.path[animation.path.length - 1]!;
    if (destination.x === unit.pos.x && destination.y === unit.pos.y) {
      unitAnimations.delete(unit.id);
    }
  }
}

function renderFrame(nowMs: number): void {
  if (!sceneRenderer || !gameState) {
    return;
  }

  const units = getRenderableUnits(nowMs);
  const renderState: GameState = { ...gameState, units };
  sceneRenderer.sync(renderState, lastPath, selectedUnitIds, selectionBox);
}

// ---------------------------------------------------------------------------
// Input Handling
// ---------------------------------------------------------------------------

/** Minimum pixel movement to distinguish a drag from a click. */
const CLICK_THRESHOLD = 5;

let pointerDown = false;
let pointerButton = -1;
let pointerShift = false;
let dragStartX = 0;
let dragStartY = 0;
let dragCameraStartX = 0;
let dragCameraStartY = 0;

function screenToTilePos(
  screenX: number,
  screenY: number,
): { tileX: number; tileY: number } {
  const worldX = screenX - cameraX;
  const worldY = screenY - cameraY;
  return screenToTile(worldX, worldY, TILE_WIDTH, TILE_HEIGHT);
}

function isInBounds(tileX: number, tileY: number): boolean {
  return (
    !!gameState &&
    tileX >= 0 &&
    tileX < gameState.map.width &&
    tileY >= 0 &&
    tileY < gameState.map.height
  );
}

function setupInput(): () => void {
  const canvas = app.canvas;

  const onPointerDown = (e: PointerEvent): void => {
    pointerDown = true;
    pointerButton = e.button;
    pointerShift = e.shiftKey;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragCameraStartX = cameraX;
    dragCameraStartY = cameraY;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!pointerDown) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const moved = Math.abs(dx) >= CLICK_THRESHOLD || Math.abs(dy) >= CLICK_THRESHOLD;

    if (!moved) return;

    if (pointerButton === 2) {
      // Right-drag → pan camera
      cameraX = dragCameraStartX + dx;
      cameraY = dragCameraStartY + dy;
      sceneRenderer?.setCamera(cameraX, cameraY);
    } else if (pointerButton === 0) {
      // Left-drag → selection box
      const start = screenToTilePos(dragStartX, dragStartY);
      const end = screenToTilePos(e.clientX, e.clientY);
      selectionBox = normalizeBox(
        { x: start.tileX, y: start.tileY },
        { x: end.tileX, y: end.tileY },
      );
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!pointerDown) return;

    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);
    const isClick = dx < CLICK_THRESHOLD && dy < CLICK_THRESHOLD;

    if (pointerButton === 0) {
      // Left button
      if (isClick) {
        handleLeftClick(e.clientX, e.clientY, pointerShift);
      } else if (selectionBox && gameState) {
        // Finish drag-box selection
        selectedUnitIds = selectUnitsByBox(
          gameState.units,
          selectionBox,
          selectedUnitIds,
          pointerShift,
        );
      }
      selectionBox = null;
    } else if (pointerButton === 2 && isClick) {
      // Right-click → move command
      handleRightClick(e.clientX, e.clientY);
    }

    pointerDown = false;
    pointerButton = -1;
  };

  // Prevent context menu on the game canvas
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

function handleLeftClick(
  screenX: number,
  screenY: number,
  isShift: boolean,
): void {
  if (!gameState) return;

  const { tileX, tileY } = screenToTilePos(screenX, screenY);
  if (!isInBounds(tileX, tileY)) return;

  const clickedUnitId = unitAtPoint(
    getRenderableUnits(performance.now()),
    { x: tileX, y: tileY },
    UNIT_SELECTION_HIT_RADIUS_TILES,
  );
  selectedUnitIds = selectUnitByClick(clickedUnitId, selectedUnitIds, isShift);
}

function handleRightClick(screenX: number, screenY: number): void {
  if (!gameState || !ws || selectedUnitIds.size === 0) return;

  const { tileX, tileY } = screenToTilePos(screenX, screenY);
  if (!isInBounds(tileX, tileY)) return;

  const target = { x: tileX, y: tileY };

  for (const unitId of selectedUnitIds) {
    ws.send(JSON.stringify({
      type: "move",
      unitId,
      target,
    }));
  }

  statusEl.textContent = `Moving ${selectedUnitIds.size} unit(s) to (${tileX}, ${tileY})…`;
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
    const msg = decodeServerMessage(event.data as string) as ServerMessage;

    if (msg.type === "state") {
      gameState = msg.state;
      reconcileAnimationsWithState(msg.state);
      syncScene();
    } else if (msg.type === "stateDiff") {
      if (gameState) {
        gameState = applyStateDiff(gameState, msg);
        reconcileAnimationsWithState(gameState);
        syncScene();
      }
    } else if (msg.type === "moveResult") {
      if (msg.success) {
        statusEl.textContent = `Move accepted for ${msg.unitId}`;
        syncScene();
      } else {
        statusEl.textContent = "Move failed!";
      }
    } else if (msg.type === "unitStep") {
      unitAnimations.delete(msg.unitId);

      const speedTilesPerSecond = 1000 / msg.durationMs;
      const animation = createUnitPathAnimation(
        [msg.from, msg.to],
        speedTilesPerSecond,
        performance.now(),
      );
      if (animation) {
        unitAnimations.set(msg.unitId, animation);
      }

      lastPath = [msg.from, msg.to];
      statusEl.textContent = `Moving ${msg.unitId} to (${msg.to.x}, ${msg.to.y})...`;
      syncScene();
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
