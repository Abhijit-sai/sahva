/** Epoch-shaped milliseconds on the Node process's monotonic clock. */
export function serverTime() {
  return Math.round(performance.timeOrigin + performance.now());
}

export type ClockSample = { offset: number; uncertainty: number };

// The response stamp fell between send and receive, even on asymmetric links.
export function alignClock(
  sent: number,
  received: number,
  stamp: number,
): ClockSample {
  return {
    offset: stamp - (sent + received) / 2,
    uncertainty: Math.ceil((received - sent) / 2),
  };
}

export type CaptureTiming = {
  onset: number;
  lastVoiced: number;
  uncertainty: number;
};

export type TurnTiming = {
  capture?: CaptureTiming;
  interim?: number;
  final?: number;
};

export function distribution(values: number[]) {
  const sorted = values
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return null;
  const middle = Math.floor(n / 2);
  const median =
    n % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    n,
    median: Math.round(median),
    p95: Math.round(sorted[Math.ceil(n * 0.95) - 1]),
    worst: Math.round(sorted[n - 1]),
  };
}
