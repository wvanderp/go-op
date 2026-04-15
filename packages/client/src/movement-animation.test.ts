import { describe, expect, it } from "vitest";
import { createTilePos } from "@go-op/types";
import {
  createUnitPathAnimation,
  sampleUnitPathAnimation,
} from "./movement-animation.js";

describe("createUnitPathAnimation", () => {
  it("returns null for invalid paths and speed", () => {
    expect(
      createUnitPathAnimation([createTilePos(0, 0)], 1, 1_000),
    ).toBeNull();
    expect(
      createUnitPathAnimation(
        [createTilePos(0, 0), createTilePos(1, 0)],
        0,
        1_000,
      ),
    ).toBeNull();
  });

  it("creates an animation starting at the beginning of the path", () => {
    const animation = createUnitPathAnimation(
      [createTilePos(0, 0), createTilePos(1, 0), createTilePos(2, 0)],
      1,
      1_000,
    );

    expect(animation).not.toBeNull();
    expect(animation!.startProgressTiles).toBe(0);
    expect(animation!.path).toHaveLength(3);
  });
});

describe("sampleUnitPathAnimation", () => {
  it("interpolates between tiles over time", () => {
    const animation = createUnitPathAnimation(
      [createTilePos(0, 0), createTilePos(1, 0)],
      1,
      10_000,
    );

    const sample = sampleUnitPathAnimation(animation!, 10_500);
    expect(sample.done).toBe(false);
    expect(sample.pos.x).toBeCloseTo(0.5);
    expect(sample.pos.y).toBe(0);
  });

  it("returns the destination tile when finished", () => {
    const animation = createUnitPathAnimation(
      [createTilePos(0, 0), createTilePos(1, 0), createTilePos(2, 0)],
      1,
      500,
    );

    const sample = sampleUnitPathAnimation(animation!, 2_700);
    expect(sample.done).toBe(true);
    expect(sample.pos).toEqual(createTilePos(2, 0));
  });
});
