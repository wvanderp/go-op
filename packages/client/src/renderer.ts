import { tileToScreen } from "@go-op/map";
import { TileType, type GameState, type TileMap, type TilePos, type Unit } from "@go-op/types";

export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}

export interface SceneFillStyle {
  readonly color: number;
  readonly alpha?: number;
}

export interface SceneStrokeStyle {
  readonly color: number;
  readonly width: number;
  readonly alpha?: number;
}

export interface SceneAnchor {
  set(x: number, y?: number): void;
}

export interface SceneGraphic {
  x: number;
  y: number;
  clear(): void;
  poly(points: ScenePoint[]): void;
  fill(style: SceneFillStyle): void;
  stroke(style: SceneStrokeStyle): void;
  circle(x: number, y: number, radius: number): void;
  destroy(): void;
}

export interface SceneText {
  text: string;
  x: number;
  y: number;
  readonly anchor: SceneAnchor;
  destroy(): void;
}

export interface SceneContainer {
  x: number;
  y: number;
  addChild(child: SceneGraphic | SceneText | SceneContainer): void;
  removeChild(child: SceneGraphic | SceneText | SceneContainer): void;
  destroy(): void;
}

export interface SceneFactory {
  createContainer(): SceneContainer;
  createGraphics(): SceneGraphic;
  createLabel(text: string): SceneText;
}

export interface CreateGameSceneRendererOptions {
  readonly stage: SceneContainer;
  readonly factory: SceneFactory;
  readonly tileWidth: number;
  readonly tileHeight: number;
}

export interface GameSceneRenderer {
  setCamera(x: number, y: number): void;
  sync(state: GameState, highlightedPath?: readonly TilePos[] | null): void;
  destroy(): void;
}

interface UnitVisual {
  readonly marker: SceneGraphic;
  readonly label: SceneText;
}

const GRASS_TILE_COLOR = 0x2d5016;
const BLOCKED_TILE_COLOR = 0x4a3728;
const PATH_TILE_COLOR = 0x3a7a1a;
const TILE_STROKE_COLOR = 0x111111;
const UNIT_BODY_COLOR = 0xe74c3c;
const UNIT_STROKE_COLOR = 0xffffff;
const TILE_FILL_ALPHA = 0.9;
const TILE_STROKE_ALPHA = 0.3;
const TILE_STROKE_WIDTH = 1;
const UNIT_RADIUS = 10;
const UNIT_VERTICAL_OFFSET = 8;
const UNIT_LABEL_OFFSET = 22;

export function createGameSceneRenderer(
  options: CreateGameSceneRendererOptions,
): GameSceneRenderer {
  const { stage, factory, tileWidth, tileHeight } = options;
  const worldContainer = factory.createContainer();
  const mapLayer = factory.createContainer();
  const unitLayer = factory.createContainer();
  const mapGraphic = factory.createGraphics();
  const unitVisuals = new Map<string, UnitVisual>();

  let renderedMap: TileMap | null = null;
  let renderedPathKey = "";

  stage.addChild(worldContainer);
  worldContainer.addChild(mapLayer);
  worldContainer.addChild(unitLayer);
  mapLayer.addChild(mapGraphic);

  return {
    setCamera(x: number, y: number): void {
      worldContainer.x = x;
      worldContainer.y = y;
    },

    sync(state: GameState, highlightedPath: readonly TilePos[] | null = null): void {
      const nextPathKey = pathKey(highlightedPath);

      if (renderedMap !== state.map || renderedPathKey !== nextPathKey) {
        redrawMap(
          mapGraphic,
          state.map,
          highlightedPath,
          tileWidth,
          tileHeight,
        );
        renderedMap = state.map;
        renderedPathKey = nextPathKey;
      }

      syncUnits(unitLayer, unitVisuals, state.units, factory, tileWidth, tileHeight);
    },

    destroy(): void {
      for (const [unitId, visual] of unitVisuals) {
        destroyUnitVisual(unitLayer, visual);
        unitVisuals.delete(unitId);
      }

      mapLayer.removeChild(mapGraphic);
      worldContainer.removeChild(mapLayer);
      worldContainer.removeChild(unitLayer);
      stage.removeChild(worldContainer);

      mapGraphic.destroy();
      mapLayer.destroy();
      unitLayer.destroy();
      worldContainer.destroy();
    },
  };
}

function redrawMap(
  mapGraphic: SceneGraphic,
  map: TileMap,
  highlightedPath: readonly TilePos[] | null,
  tileWidth: number,
  tileHeight: number,
): void {
  const highlightedTiles = new Set((highlightedPath ?? []).map(tileKey));

  mapGraphic.clear();

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tiles[y * map.width + x]!;
      const { sx, sy } = tileToScreen(x, y, tileWidth, tileHeight);
      const fillColor = getTileColor(tile, highlightedTiles.has(tileKey({ x, y })));

      mapGraphic.poly([
        { x: sx, y: sy - tileHeight / 2 },
        { x: sx + tileWidth / 2, y: sy },
        { x: sx, y: sy + tileHeight / 2 },
        { x: sx - tileWidth / 2, y: sy },
      ]);
      mapGraphic.fill({ color: fillColor, alpha: TILE_FILL_ALPHA });
      mapGraphic.stroke({
        color: TILE_STROKE_COLOR,
        width: TILE_STROKE_WIDTH,
        alpha: TILE_STROKE_ALPHA,
      });
    }
  }
}

function syncUnits(
  unitLayer: SceneContainer,
  unitVisuals: Map<string, UnitVisual>,
  units: readonly Unit[],
  factory: SceneFactory,
  tileWidth: number,
  tileHeight: number,
): void {
  const nextUnitIds = new Set<string>();

  for (const unit of units) {
    nextUnitIds.add(unit.id);

    let visual = unitVisuals.get(unit.id);
    if (!visual) {
      visual = {
        marker: factory.createGraphics(),
        label: factory.createLabel(unit.id),
      };
      visual.label.anchor.set(0.5, 1);
      unitLayer.addChild(visual.marker);
      unitLayer.addChild(visual.label);
      unitVisuals.set(unit.id, visual);
    }

    updateUnitVisual(visual, unit, tileWidth, tileHeight);
  }

  for (const [unitId, visual] of unitVisuals) {
    if (nextUnitIds.has(unitId)) {
      continue;
    }

    destroyUnitVisual(unitLayer, visual);
    unitVisuals.delete(unitId);
  }
}

function updateUnitVisual(
  visual: UnitVisual,
  unit: Unit,
  tileWidth: number,
  tileHeight: number,
): void {
  const { sx, sy } = tileToScreen(unit.pos.x, unit.pos.y, tileWidth, tileHeight);

  visual.marker.clear();
  visual.marker.circle(0, 0, UNIT_RADIUS);
  visual.marker.fill({ color: UNIT_BODY_COLOR });
  visual.marker.stroke({ color: UNIT_STROKE_COLOR, width: 2 });
  visual.marker.x = sx;
  visual.marker.y = sy - UNIT_VERTICAL_OFFSET;

  visual.label.text = unit.id;
  visual.label.x = sx;
  visual.label.y = sy - UNIT_LABEL_OFFSET;
}

function destroyUnitVisual(unitLayer: SceneContainer, visual: UnitVisual): void {
  unitLayer.removeChild(visual.marker);
  unitLayer.removeChild(visual.label);
  visual.marker.destroy();
  visual.label.destroy();
}

function getTileColor(tile: TileType, isOnPath: boolean): number {
  if (tile === TileType.Blocked) {
    return BLOCKED_TILE_COLOR;
  }

  if (isOnPath) {
    return PATH_TILE_COLOR;
  }

  return GRASS_TILE_COLOR;
}

function pathKey(path: readonly TilePos[] | null): string {
  return (path ?? []).map(tileKey).join("|");
}

function tileKey(tile: TilePos): string {
  return `${tile.x},${tile.y}`;
}
