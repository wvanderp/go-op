import { describe, it, expect } from "vitest";
import {
  type FixedPoint,
  FP_SHIFT,
  FP_SCALE,
  FP_ONE,
  FP_ZERO,
  FP_HALF,
  fpFromInt,
  fpFromFloat,
  fpToInt,
  fpToFloat,
  fpAdd,
  fpSub,
  fpMul,
  fpDiv,
  fpAbs,
  fpFloor,
  fpCeil,
  fpEq,
  fpLt,
  fpGt,
  fpLte,
  fpGte,
  fpMin,
  fpMax,
} from "@go-op/math";

describe("fixed-point constants", () => {
  it("has correct shift and scale", () => {
    expect(FP_SHIFT).toBe(16);
    expect(FP_SCALE).toBe(65536);
  });

  it("FP_ONE equals scale", () => {
    expect(FP_ONE).toBe(65536);
  });

  it("FP_ZERO equals 0", () => {
    expect(FP_ZERO).toBe(0);
  });

  it("FP_HALF equals scale / 2", () => {
    expect(FP_HALF).toBe(32768);
  });
});

describe("fixed-point constructors", () => {
  it("fpFromInt converts integers", () => {
    expect(fpFromInt(0)).toBe(0);
    expect(fpFromInt(1)).toBe(65536);
    expect(fpFromInt(10)).toBe(655360);
    expect(fpFromInt(-3)).toBe(-196608);
  });

  it("fpFromFloat converts floats", () => {
    expect(fpFromFloat(0.5)).toBe(32768);
    expect(fpFromFloat(1.5)).toBe(98304);
    expect(fpFromFloat(-2.25)).toBe(-147456);
  });

  it("fpToInt truncates toward zero", () => {
    expect(fpToInt(fpFromInt(5))).toBe(5);
    expect(fpToInt(fpFromFloat(5.9))).toBe(5);
    expect(fpToInt(fpFromFloat(-3.7))).toBe(-3);
    expect(fpToInt(FP_ZERO)).toBe(0);
  });

  it("fpToFloat recovers original value", () => {
    expect(fpToFloat(fpFromInt(7))).toBe(7);
    expect(fpToFloat(fpFromFloat(3.5))).toBeCloseTo(3.5, 4);
    expect(fpToFloat(FP_HALF)).toBeCloseTo(0.5, 4);
  });
});

describe("fixed-point arithmetic", () => {
  it("fpAdd adds two values", () => {
    const a = fpFromInt(3);
    const b = fpFromInt(4);
    expect(fpToInt(fpAdd(a, b))).toBe(7);
  });

  it("fpAdd works with fractional values", () => {
    const a = fpFromFloat(1.5);
    const b = fpFromFloat(2.25);
    expect(fpToFloat(fpAdd(a, b))).toBeCloseTo(3.75, 4);
  });

  it("fpSub subtracts two values", () => {
    const a = fpFromInt(10);
    const b = fpFromInt(3);
    expect(fpToInt(fpSub(a, b))).toBe(7);
  });

  it("fpSub can produce negative results", () => {
    const a = fpFromInt(3);
    const b = fpFromInt(10);
    expect(fpToInt(fpSub(a, b))).toBe(-7);
  });

  it("fpMul multiplies two values", () => {
    const a = fpFromInt(3);
    const b = fpFromInt(4);
    expect(fpToInt(fpMul(a, b))).toBe(12);
  });

  it("fpMul handles fractional multiplication", () => {
    const a = fpFromFloat(2.5);
    const b = fpFromFloat(3.0);
    expect(fpToFloat(fpMul(a, b))).toBeCloseTo(7.5, 4);
  });

  it("fpMul handles negative values", () => {
    const a = fpFromInt(3);
    const b = fpFromInt(-4);
    expect(fpToInt(fpMul(a, b))).toBe(-12);
  });

  it("fpDiv divides two values", () => {
    const a = fpFromInt(12);
    const b = fpFromInt(4);
    expect(fpToInt(fpDiv(a, b))).toBe(3);
  });

  it("fpDiv handles fractional results", () => {
    const a = fpFromInt(7);
    const b = fpFromInt(2);
    expect(fpToFloat(fpDiv(a, b))).toBeCloseTo(3.5, 4);
  });

  it("fpDiv handles negative values", () => {
    const a = fpFromInt(-9);
    const b = fpFromInt(3);
    expect(fpToInt(fpDiv(a, b))).toBe(-3);
  });

  it("fpAbs returns absolute value", () => {
    expect(fpAbs(fpFromInt(5))).toBe(fpFromInt(5));
    expect(fpAbs(fpFromInt(-5))).toBe(fpFromInt(5));
    expect(fpAbs(FP_ZERO)).toBe(FP_ZERO);
  });

  it("fpFloor floors to nearest integer FP", () => {
    expect(fpToInt(fpFloor(fpFromFloat(3.7)))).toBe(3);
    expect(fpToInt(fpFloor(fpFromFloat(-2.3)))).toBe(-3);
    expect(fpToInt(fpFloor(fpFromInt(5)))).toBe(5);
  });

  it("fpCeil ceils to nearest integer FP", () => {
    expect(fpToInt(fpCeil(fpFromFloat(3.2)))).toBe(4);
    expect(fpToInt(fpCeil(fpFromFloat(-2.7)))).toBe(-2);
    expect(fpToInt(fpCeil(fpFromInt(5)))).toBe(5);
  });
});

describe("fixed-point comparisons", () => {
  it("fpEq compares equality", () => {
    expect(fpEq(fpFromInt(3), fpFromInt(3))).toBe(true);
    expect(fpEq(fpFromInt(3), fpFromInt(4))).toBe(false);
  });

  it("fpLt compares less than", () => {
    expect(fpLt(fpFromInt(3), fpFromInt(4))).toBe(true);
    expect(fpLt(fpFromInt(4), fpFromInt(3))).toBe(false);
    expect(fpLt(fpFromInt(3), fpFromInt(3))).toBe(false);
  });

  it("fpGt compares greater than", () => {
    expect(fpGt(fpFromInt(4), fpFromInt(3))).toBe(true);
    expect(fpGt(fpFromInt(3), fpFromInt(4))).toBe(false);
    expect(fpGt(fpFromInt(3), fpFromInt(3))).toBe(false);
  });

  it("fpLte compares less than or equal", () => {
    expect(fpLte(fpFromInt(3), fpFromInt(4))).toBe(true);
    expect(fpLte(fpFromInt(3), fpFromInt(3))).toBe(true);
    expect(fpLte(fpFromInt(4), fpFromInt(3))).toBe(false);
  });

  it("fpGte compares greater than or equal", () => {
    expect(fpGte(fpFromInt(4), fpFromInt(3))).toBe(true);
    expect(fpGte(fpFromInt(3), fpFromInt(3))).toBe(true);
    expect(fpGte(fpFromInt(3), fpFromInt(4))).toBe(false);
  });

  it("fpMin returns the smaller value", () => {
    expect(fpMin(fpFromInt(3), fpFromInt(7))).toBe(fpFromInt(3));
    expect(fpMin(fpFromInt(7), fpFromInt(3))).toBe(fpFromInt(3));
  });

  it("fpMax returns the larger value", () => {
    expect(fpMax(fpFromInt(3), fpFromInt(7))).toBe(fpFromInt(7));
    expect(fpMax(fpFromInt(7), fpFromInt(3))).toBe(fpFromInt(7));
  });
});
