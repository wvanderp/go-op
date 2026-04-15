import { describe, expect, it } from "vitest";
import { createMap, setTile } from "@go-op/map";
import { TileType, createTilePos, type GameState, type Unit } from "@go-op/types";
import {
  createGameSceneRenderer,
  type SceneContainer,
  type SceneFactory,
  type SceneGraphic,
  type SceneText,
} from "./renderer.js";

class FakeGraphic implements SceneGraphic {
  x = 0;
  y = 0;
  destroyed = false;
  clearCalls = 0;
  circleCalls = 0;
  lastPolyPoints: Array<{ x: number; y: number }> | null = null;
  fillColors: number[] = [];

  clear(): void {
    this.clearCalls += 1;
    this.circleCalls = 0;
  }

  poly(points: Array<{ x: number; y: number }>): void {
    this.lastPolyPoints = points;
  }

  fill(style: { color: number }): void {
    this.fillColors.push(style.color);
  }

  stroke(): void {}

  circle(): void {
    this.circleCalls += 1;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeText implements SceneText {
  text: string;
  x = 0;
  y = 0;
  destroyed = false;
  anchor = {
    set: (x: number, y = x): void => {
      this.anchorX = x;
      this.anchorY = y;
    },
  };
  anchorX = 0;
  anchorY = 0;

  constructor(text: string) {
    this.text = text;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeContainer implements SceneContainer {
  x = 0;
  y = 0;
  destroyed = false;
  children: Array<SceneContainer | SceneGraphic | SceneText> = [];

  addChild(child: SceneContainer | SceneGraphic | SceneText): void {
    if (!this.children.includes(child)) {
      this.children.push(child);
    }
  }

  removeChild(child: SceneContainer | SceneGraphic | SceneText): void {
    this.children = this.children.filter((entry) => entry !== child);
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeSceneFactory implements SceneFactory {
  readonly containers: FakeContainer[] = [];
  readonly graphics: FakeGraphic[] = [];
  readonly labels: FakeText[] = [];

  createContainer(): SceneContainer {
    const container = new FakeContainer();
    this.containers.push(container);
    return container;
  }

  createGraphics(): SceneGraphic {
    const graphic = new FakeGraphic();
    this.graphics.push(graphic);
    return graphic;
  }

  createLabel(text: string): SceneText {
    const label = new FakeText(text);
    this.labels.push(label);
    return label;
  }
}

function createState(units: readonly Unit[]): GameState {
  return {
    map: createMap(2, 2),
    units,
  };
}

function createStateWithBlockedTile(units: readonly Unit[]): GameState {
  return {
    map: setTile(createMap(2, 2), 1, 0, TileType.Blocked),
    units,
  };
}

describe("createGameSceneRenderer", () => {
  it("reuses display objects across repeated syncs", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });
    const firstState = createState([
      { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1, action: { type: "idle" } },
    ]);

    renderer.sync(firstState, [createTilePos(0, 0), createTilePos(1, 0)]);

    const mapGraphic = factory.graphics[0];
    const overlayGraphic = factory.graphics[1];
    const unitGraphic = factory.graphics[2];
    const unitLabel = factory.labels[0];
    const initialUnitY = unitGraphic.y;
    const world = stage.children[0];

    renderer.setCamera(128, -96);

    renderer.sync(
      createState([
        { id: "unit-1", pos: createTilePos(1, 1), speedTilesPerSecond: 1, action: { type: "idle" } },
      ]),
      [createTilePos(0, 0), createTilePos(1, 0)],
    );

    expect(factory.containers).toHaveLength(3);
    expect(factory.graphics).toHaveLength(3);
    expect(factory.labels).toHaveLength(1);
    expect(stage.children).toHaveLength(1);
    expect(stage.children[0]).toBe(world);
    expect(world.x).toBe(128);
    expect(world.y).toBe(-96);
    expect(factory.graphics[0]).toBe(mapGraphic);
    expect(factory.graphics[1]).toBe(overlayGraphic);
    expect(factory.graphics[2]).toBe(unitGraphic);
    expect(factory.labels[0]).toBe(unitLabel);
    expect(unitGraphic.y).not.toBe(initialUnitY);
  });

  it("destroys visuals only for units that leave the scene", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });

    renderer.sync(
      createState([
        { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1, action: { type: "idle" } },
        { id: "unit-2", pos: createTilePos(1, 0), speedTilesPerSecond: 1, action: { type: "idle" } },
      ]),
      null,
    );

    const unitOneGraphic = factory.graphics[2];
    const unitTwoGraphic = factory.graphics[3];
    const unitOneLabel = factory.labels[0];
    const unitTwoLabel = factory.labels[1];

    renderer.sync(
      createState([
        { id: "unit-2", pos: createTilePos(1, 1), speedTilesPerSecond: 1, action: { type: "idle" } },
      ]),
      null,
    );

    expect(factory.graphics).toHaveLength(4);
    expect(factory.labels).toHaveLength(2);
    expect(unitOneGraphic.destroyed).toBe(true);
    expect(unitOneLabel.destroyed).toBe(true);
    expect(unitTwoGraphic.destroyed).toBe(false);
    expect(unitTwoLabel.destroyed).toBe(false);
  });

  it("redraws the map layer without allocating replacement graphics", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });
    const state = createState([]);

    renderer.sync(state, null);

    const mapGraphic = factory.graphics[0];

    renderer.sync(state, [createTilePos(0, 0), createTilePos(1, 0)]);

    expect(factory.containers).toHaveLength(3);
    expect(factory.graphics).toHaveLength(2);
    expect(factory.labels).toHaveLength(0);
    expect(factory.graphics[0]).toBe(mapGraphic);
    expect(mapGraphic.clearCalls).toBe(2);
  });

  it("skips map redraw when the map and highlighted path are unchanged", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });
    const state = createState([]);

    renderer.sync(state, [createTilePos(0, 0), createTilePos(1, 0)]);

    const mapGraphic = factory.graphics[0];

    renderer.sync(state, [createTilePos(0, 0), createTilePos(1, 0)]);

    expect(mapGraphic.clearCalls).toBe(1);
  });

  it("destroys owned scene objects and renders blocked tiles", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });

    renderer.sync(
      createStateWithBlockedTile([
        { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1, action: { type: "idle" } },
      ]),
      null,
    );

    const mapGraphic = factory.graphics[0];
    const unitGraphic = factory.graphics[2];
    const unitLabel = factory.labels[0];

    expect(mapGraphic.fillColors).toContain(0x4a3728);

    renderer.destroy();

    expect(stage.children).toHaveLength(0);
    expect(mapGraphic.destroyed).toBe(true);
    expect(unitGraphic.destroyed).toBe(true);
    expect(unitLabel.destroyed).toBe(true);
    expect(factory.containers.every((container) => container.destroyed)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Selection visuals
  // -------------------------------------------------------------------------

  it("draws a selection ring on selected units", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });

    renderer.sync(
      createState([
        { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1, action: { type: "idle" } },
        { id: "unit-2", pos: createTilePos(1, 0), speedTilesPerSecond: 1, action: { type: "idle" } },
      ]),
      null,
      new Set(["unit-1"]),
    );

    // unit-1 marker should contain a selection ring (extra circle call)
    // unit-2 marker should not
    const unit1Marker = factory.graphics[2]!; // graphics[0] = map, [1] = overlay
    const unit2Marker = factory.graphics[3]!;

    // Selected unit gets 2 circle calls (selection ring + body); unselected gets 1
    expect(unit1Marker.circleCalls).toBe(2);
    expect(unit2Marker.circleCalls).toBe(1);
  });

  it("removes selection ring when unit is deselected", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });

    const state = createState([
      { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1, action: { type: "idle" } },
    ]);

    // First sync: unit-1 is selected
    renderer.sync(state, null, new Set(["unit-1"]));
    const unitMarker = factory.graphics[2]!;
    expect(unitMarker.circleCalls).toBe(2);

    // Second sync: unit-1 is no longer selected
    renderer.sync(state, null, new Set());
    // After clear + redraw, only 1 circle (body only)
    expect(unitMarker.circleCalls).toBe(1);
  });

  it("renders a drag-selection box overlay", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });

    const state = createState([]);
    const selectionBox = { minX: 0, minY: 0, maxX: 2, maxY: 2 };

    renderer.sync(state, null, new Set(), selectionBox);

    // A dedicated overlay graphic should have been drawn (rect via poly)
    // The overlay graphic is separate from the map graphic
    const overlayGraphic = factory.graphics[1]; // graphics[0] = map, [1] = overlay
    expect(overlayGraphic).toBeDefined();
    expect(overlayGraphic!.clearCalls).toBeGreaterThanOrEqual(1);
  });

  it("anchors a single-tile selection box at tile corners", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });

    renderer.sync(
      createState([]),
      null,
      new Set(),
      { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    );

    const overlayGraphic = factory.graphics[1]!;

    expect(overlayGraphic.lastPolyPoints).toEqual([
      { x: 0, y: -16 },
      { x: 32, y: 0 },
      { x: 0, y: 16 },
      { x: -32, y: 0 },
    ]);
  });

  it("attaches the selection overlay graphic to the scene graph", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();

    createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });

    const world = stage.children[0] as FakeContainer;
    const mapLayer = world.children[0] as FakeContainer;
    const overlayGraphic = factory.graphics[1];

    expect(mapLayer.children).toContain(overlayGraphic);
  });

  it("clears drag-selection box when no longer active", () => {
    const factory = new FakeSceneFactory();
    const stage = new FakeContainer();
    const renderer = createGameSceneRenderer({
      stage,
      factory,
      tileWidth: 64,
      tileHeight: 32,
    });

    const state = createState([]);
    const selectionBox = { minX: 0, minY: 0, maxX: 2, maxY: 2 };

    // Draw box
    renderer.sync(state, null, new Set(), selectionBox);
    const overlayGraphic = factory.graphics[1]!; // overlay

    // Clear box (no selectionBox)
    renderer.sync(state, null, new Set());
    // Overlay graphic should have been cleared
    expect(overlayGraphic.clearCalls).toBeGreaterThanOrEqual(2);
  });
});
