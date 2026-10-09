export interface DeterministicClock {
  now(): number;
  nowDate(): Date;
  nowIso(): string;
  advance(milliseconds: number): void;
}

export function createDeterministicClock(initial: string | number | Date): DeterministicClock {
  let current = new Date(initial).getTime();
  if (!Number.isFinite(current)) throw new Error("Deterministic clock requires a valid initial value");
  return {
    now: () => current,
    nowDate: () => new Date(current),
    nowIso: () => new Date(current).toISOString(),
    advance(milliseconds: number): void {
      if (!Number.isFinite(milliseconds)) throw new Error("Clock advance must be finite");
      current += milliseconds;
    },
  };
}

export function createDeterministicIdFactory(prefix = "id"): () => string {
  if (prefix.trim().length === 0) throw new Error("ID prefix must not be empty");
  let sequence = 0;
  return () => `${prefix}-${++sequence}`;
}
