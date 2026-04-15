import type { TilePos } from "@go-op/types";

export interface UnitPathAnimation {
  readonly path: readonly TilePos[];
  readonly speedTilesPerSecond: number;
  readonly startedAtMs: number;
  readonly startProgressTiles: number;
}

export interface UnitPathSample {
  readonly pos: TilePos;
  readonly done: boolean;
}

export function createUnitPathAnimation(
  path: readonly TilePos[],
  speedTilesPerSecond: number,
  startedAtMs: number,
): UnitPathAnimation | null {
  if (path.length < 2 || speedTilesPerSecond <= 0) {
    return null;
  }

  return {
    path,
    speedTilesPerSecond,
    startedAtMs,
    startProgressTiles: 0,
  };
}

export function sampleUnitPathAnimation(
  animation: UnitPathAnimation,
  nowMs: number,
): UnitPathSample {
  const maxProgressTiles = animation.path.length - 1;
  const elapsedMs = Math.max(0, nowMs - animation.startedAtMs);
  const progressTiles =
    animation.startProgressTiles +
    (elapsedMs / 1000) * animation.speedTilesPerSecond;

  if (progressTiles >= maxProgressTiles) {
    return {
      pos: animation.path[maxProgressTiles]!,
      done: true,
    };
  }

  const fromIndex = Math.floor(progressTiles);
  const toIndex = Math.min(fromIndex + 1, maxProgressTiles);
  const t = progressTiles - fromIndex;
  const from = animation.path[fromIndex]!;
  const to = animation.path[toIndex]!;

  return {
    pos: {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    },
    done: false,
  };
}
