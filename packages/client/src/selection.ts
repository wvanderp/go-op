import type { TilePos, Unit } from "@go-op/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Axis-aligned tile-coordinate bounding box (inclusive). */
export interface TileBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

// ---------------------------------------------------------------------------
// Click Selection
// ---------------------------------------------------------------------------

/**
 * Compute the next selection after a click.
 *
 * - Without shift: clicking a unit replaces the selection; clicking empty
 *   space clears it.
 * - With shift: clicking a unit toggles it in/out; clicking empty space
 *   leaves the selection unchanged.
 */
export function selectUnitByClick(
  unitId: string | null,
  previousSelection: ReadonlySet<string>,
  isShift: boolean,
): Set<string> {
  if (isShift) {
    if (unitId === null) {
      return new Set(previousSelection);
    }
    const next = new Set(previousSelection);
    if (next.has(unitId)) {
      next.delete(unitId);
    } else {
      next.add(unitId);
    }
    return next;
  }

  // No shift
  if (unitId === null) {
    return new Set();
  }
  return new Set([unitId]);
}

// ---------------------------------------------------------------------------
// Box Helpers
// ---------------------------------------------------------------------------

/** Normalize two corner positions into a min/max bounding box. */
export function normalizeBox(a: TilePos, b: TilePos): TileBox {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

// ---------------------------------------------------------------------------
// Box Selection
// ---------------------------------------------------------------------------

/**
 * Select all units whose tile position falls inside `box` (inclusive).
 *
 * - Without shift the result replaces any previous selection.
 * - With shift the result is the union of `previousSelection` and the
 *   box-matched units.
 */
export function selectUnitsByBox(
  units: readonly Unit[],
  box: TileBox,
  previousSelection: ReadonlySet<string>,
  isShift: boolean,
): Set<string> {
  const boxed = new Set<string>();
  for (const u of units) {
    if (
      u.pos.x >= box.minX &&
      u.pos.x <= box.maxX &&
      u.pos.y >= box.minY &&
      u.pos.y <= box.maxY
    ) {
      boxed.add(u.id);
    }
  }

  if (isShift) {
    const merged = new Set(previousSelection);
    for (const id of boxed) {
      merged.add(id);
    }
    return merged;
  }

  return boxed;
}

// ---------------------------------------------------------------------------
// Hit-Testing
// ---------------------------------------------------------------------------

/** Return the id of the first unit occupying `tile`, or null. */
export function unitAtTile(
  units: readonly Unit[],
  tile: TilePos,
): string | null {
  for (const u of units) {
    if (u.pos.x === tile.x && u.pos.y === tile.y) {
      return u.id;
    }
  }
  return null;
}

/** Return the nearest unit id within a tile-space hit radius, or null. */
export function unitAtPoint(
  units: readonly Unit[],
  point: TilePos,
  hitRadiusTiles: number,
): string | null {
  const radiusSq = hitRadiusTiles * hitRadiusTiles;
  let bestId: string | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const u of units) {
    const dx = u.pos.x - point.x;
    const dy = u.pos.y - point.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > radiusSq || distSq >= bestDistSq) {
      continue;
    }

    bestDistSq = distSq;
    bestId = u.id;
  }

  return bestId;
}
