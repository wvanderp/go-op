import { describe, it, expect } from "vitest";
import {
  type FpVec2,
  fpFromInt,
  fpFromFloat,
  fpToFloat,
  fpToInt,
  vec2,
  vec2Add,
  vec2Sub,
  vec2ManhattanDist,
  vec2Eq,
} from "@go-op/math";

describe("FpVec2", () => {
  it("vec2 creates a vector from two fixed-point values", () => {
    const v = vec2(fpFromInt(3), fpFromInt(4));
    expect(fpToInt(v.x)).toBe(3);
    expect(fpToInt(v.y)).toBe(4);
  });

  it("vec2Add adds two vectors", () => {
    const a = vec2(fpFromInt(1), fpFromInt(2));
    const b = vec2(fpFromInt(3), fpFromInt(4));
    const result = vec2Add(a, b);
    expect(fpToInt(result.x)).toBe(4);
    expect(fpToInt(result.y)).toBe(6);
  });

  it("vec2Sub subtracts two vectors", () => {
    const a = vec2(fpFromInt(5), fpFromInt(7));
    const b = vec2(fpFromInt(2), fpFromInt(3));
    const result = vec2Sub(a, b);
    expect(fpToInt(result.x)).toBe(3);
    expect(fpToInt(result.y)).toBe(4);
  });

  it("vec2ManhattanDist calculates manhattan distance", () => {
    const a = vec2(fpFromInt(1), fpFromInt(2));
    const b = vec2(fpFromInt(4), fpFromInt(6));
    const dist = vec2ManhattanDist(a, b);
    expect(fpToInt(dist)).toBe(7); // |4-1| + |6-2| = 3 + 4
  });

  it("vec2ManhattanDist works with negative coordinates", () => {
    const a = vec2(fpFromInt(-2), fpFromInt(3));
    const b = vec2(fpFromInt(1), fpFromInt(-1));
    const dist = vec2ManhattanDist(a, b);
    expect(fpToInt(dist)).toBe(7); // |1-(-2)| + |(-1)-3| = 3 + 4
  });

  it("vec2ManhattanDist works with fractional values", () => {
    const a = vec2(fpFromFloat(1.5), fpFromFloat(2.5));
    const b = vec2(fpFromFloat(3.0), fpFromFloat(4.0));
    const dist = vec2ManhattanDist(a, b);
    expect(fpToFloat(dist)).toBeCloseTo(3.0, 4); // |3-1.5| + |4-2.5| = 1.5 + 1.5
  });

  it("vec2Eq checks equality", () => {
    const a = vec2(fpFromInt(3), fpFromInt(4));
    const b = vec2(fpFromInt(3), fpFromInt(4));
    const c = vec2(fpFromInt(3), fpFromInt(5));
    expect(vec2Eq(a, b)).toBe(true);
    expect(vec2Eq(a, c)).toBe(false);
  });
});
