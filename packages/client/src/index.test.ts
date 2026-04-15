import { describe, it, expect } from "vitest";

describe("@go-op/client", () => {
  it("should be importable", async () => {
    const mod = await import("../src/index.js");
    expect(mod).toBeDefined();
  });
});
