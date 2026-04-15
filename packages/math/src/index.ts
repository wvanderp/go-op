// ---------------------------------------------------------------------------
// Fixed-Point Arithmetic (Q16.16)
// ---------------------------------------------------------------------------

/** Branded type for fixed-point numbers with 16 fractional bits. */
export type FixedPoint = number & { readonly __fp: unique symbol };

export const FP_SHIFT = 16;
export const FP_SCALE = 1 << FP_SHIFT; // 65536

export const FP_ONE = FP_SCALE as unknown as FixedPoint;
export const FP_ZERO = 0 as unknown as FixedPoint;
export const FP_HALF = (FP_SCALE >>> 1) as unknown as FixedPoint;

// -- Constructors -----------------------------------------------------------

export function fpFromInt(n: number): FixedPoint {
  return (n << FP_SHIFT) as unknown as FixedPoint;
}

/** Convert a floating-point number to fixed-point. For tests/debug only. */
export function fpFromFloat(n: number): FixedPoint {
  return Math.round(n * FP_SCALE) as unknown as FixedPoint;
}

export function fpToInt(fp: FixedPoint): number {
  return Math.trunc((fp as unknown as number) / FP_SCALE);
}

export function fpToFloat(fp: FixedPoint): number {
  return (fp as unknown as number) / FP_SCALE;
}

// -- Arithmetic -------------------------------------------------------------

export function fpAdd(a: FixedPoint, b: FixedPoint): FixedPoint {
  return ((a as unknown as number) + (b as unknown as number)) as unknown as FixedPoint;
}

export function fpSub(a: FixedPoint, b: FixedPoint): FixedPoint {
  return ((a as unknown as number) - (b as unknown as number)) as unknown as FixedPoint;
}

export function fpMul(a: FixedPoint, b: FixedPoint): FixedPoint {
  return Math.trunc(
    ((a as unknown as number) * (b as unknown as number)) / FP_SCALE,
  ) as unknown as FixedPoint;
}

export function fpDiv(a: FixedPoint, b: FixedPoint): FixedPoint {
  return Math.trunc(
    ((a as unknown as number) * FP_SCALE) / (b as unknown as number),
  ) as unknown as FixedPoint;
}

export function fpAbs(a: FixedPoint): FixedPoint {
  const n = a as unknown as number;
  return (n < 0 ? -n : n) as unknown as FixedPoint;
}

export function fpFloor(a: FixedPoint): FixedPoint {
  return ((a as unknown as number) & ~(FP_SCALE - 1)) as unknown as FixedPoint;
}

export function fpCeil(a: FixedPoint): FixedPoint {
  const n = a as unknown as number;
  const mask = FP_SCALE - 1;
  return ((n & mask) === 0 ? n : (n & ~mask) + FP_SCALE) as unknown as FixedPoint;
}

// -- Comparisons ------------------------------------------------------------

export function fpEq(a: FixedPoint, b: FixedPoint): boolean {
  return (a as unknown as number) === (b as unknown as number);
}

export function fpLt(a: FixedPoint, b: FixedPoint): boolean {
  return (a as unknown as number) < (b as unknown as number);
}

export function fpGt(a: FixedPoint, b: FixedPoint): boolean {
  return (a as unknown as number) > (b as unknown as number);
}

export function fpLte(a: FixedPoint, b: FixedPoint): boolean {
  return (a as unknown as number) <= (b as unknown as number);
}

export function fpGte(a: FixedPoint, b: FixedPoint): boolean {
  return (a as unknown as number) >= (b as unknown as number);
}

export function fpMin(a: FixedPoint, b: FixedPoint): FixedPoint {
  return (a as unknown as number) <= (b as unknown as number) ? a : b;
}

export function fpMax(a: FixedPoint, b: FixedPoint): FixedPoint {
  return (a as unknown as number) >= (b as unknown as number) ? a : b;
}

// ---------------------------------------------------------------------------
// 2D Fixed-Point Vector
// ---------------------------------------------------------------------------

export interface FpVec2 {
  readonly x: FixedPoint;
  readonly y: FixedPoint;
}

export function vec2(x: FixedPoint, y: FixedPoint): FpVec2 {
  return { x, y };
}

export function vec2Add(a: FpVec2, b: FpVec2): FpVec2 {
  return { x: fpAdd(a.x, b.x), y: fpAdd(a.y, b.y) };
}

export function vec2Sub(a: FpVec2, b: FpVec2): FpVec2 {
  return { x: fpSub(a.x, b.x), y: fpSub(a.y, b.y) };
}

export function vec2ManhattanDist(a: FpVec2, b: FpVec2): FixedPoint {
  return fpAdd(fpAbs(fpSub(a.x, b.x)), fpAbs(fpSub(a.y, b.y)));
}

export function vec2Eq(a: FpVec2, b: FpVec2): boolean {
  return fpEq(a.x, b.x) && fpEq(a.y, b.y);
}
