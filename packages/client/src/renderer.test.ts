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
  fillColors: number[] = [];

  clear(): void {
    this.clearCalls += 1;
  }

  poly(): void {}

  fill(style: { color: number }): void {
    this.fillColors.push(style.color);
  }

  stroke(): void {}

  circle(): void {}

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
      { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1 },
    ]);

    renderer.sync(firstState, [createTilePos(0, 0), createTilePos(1, 0)]);

    const mapGraphic = factory.graphics[0];
    const unitGraphic = factory.graphics[1];
    const unitLabel = factory.labels[0];
    const initialUnitY = unitGraphic.y;
    const world = stage.children[0];

    renderer.setCamera(128, -96);

    renderer.sync(
      createState([
        { id: "unit-1", pos: createTilePos(1, 1), speedTilesPerSecond: 1 },
      ]),
      [createTilePos(0, 0), createTilePos(1, 0)],
    );

    expect(factory.containers).toHaveLength(3);
    expect(factory.graphics).toHaveLength(2);
    expect(factory.labels).toHaveLength(1);
    expect(stage.children).toHaveLength(1);
    expect(stage.children[0]).toBe(world);
    expect(world.x).toBe(128);
    expect(world.y).toBe(-96);
    expect(factory.graphics[0]).toBe(mapGraphic);
    expect(factory.graphics[1]).toBe(unitGraphic);
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
        { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1 },
        { id: "unit-2", pos: createTilePos(1, 0), speedTilesPerSecond: 1 },
      ]),
      null,
    );

    const unitOneGraphic = factory.graphics[1];
    const unitTwoGraphic = factory.graphics[2];
    const unitOneLabel = factory.labels[0];
    const unitTwoLabel = factory.labels[1];

    renderer.sync(
      createState([
        { id: "unit-2", pos: createTilePos(1, 1), speedTilesPerSecond: 1 },
      ]),
      null,
    );

    expect(factory.graphics).toHaveLength(3);
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
    expect(factory.graphics).toHaveLength(1);
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
        { id: "unit-1", pos: createTilePos(0, 0), speedTilesPerSecond: 1 },
      ]),
      null,
    );

    const mapGraphic = factory.graphics[0];
    const unitGraphic = factory.graphics[1];
    const unitLabel = factory.labels[0];

    expect(mapGraphic.fillColors).toContain(0x4a3728);

    renderer.destroy();

    expect(stage.children).toHaveLength(0);
    expect(mapGraphic.destroyed).toBe(true);
    expect(unitGraphic.destroyed).toBe(true);
    expect(unitLabel.destroyed).toBe(true);
    expect(factory.containers.every((container) => container.destroyed)).toBe(true);
  });
});
