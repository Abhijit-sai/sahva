import { describe, expect, it } from "vitest";
import { alignClock, distribution } from "../lib/rehearsal";

describe("room timing observations", () => {
  it("correlates devices with different monotonic origins and retains a round-trip error bound", () => {
    const speaker = alignClock(20, 40, 1000);
    const listener = alignClock(420, 460, 1000);
    expect(1030 + speaker.offset).toBe(1440 + listener.offset);
    expect(speaker.uncertainty + listener.uncertainty).toBe(30);
  });
  it("uses a median and nearest-rank p95 and counts only observed delays", () => {
    expect(distribution([])).toBeNull();
    expect(distribution([NaN, -10, 1, 2, 4, 6])).toEqual({
      n: 4,
      median: 3,
      p95: 6,
      worst: 6,
    });
    expect(distribution(Array.from({ length: 20 }, (_, i) => i + 1))?.p95).toBe(
      19,
    );
  });
});
