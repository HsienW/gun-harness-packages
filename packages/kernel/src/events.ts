import {
  RUNTIME_EVENT_PAYLOAD_SCHEMAS,
  RUNTIME_EVENT_TYPES,
  durableInterruptManifestSchema,
  runtimeEventEnvelopeSchema,
  type DurableInterruptManifest,
  type RuntimeEventPayload,
  type RuntimeEventSchemaVersion,
  type RuntimeEventType,
} from "@gun-ai/harness-contracts";

const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseRuntimeEventSchemaVersion(value: string): RuntimeEventSchemaVersion {
  const match = semverPattern.exec(value);
  if (!match) throw new Error(`Invalid runtime event schema version: ${value}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function parseRuntimeEventEnvelope(value: unknown): ReturnType<typeof runtimeEventEnvelopeSchema.parse> {
  return runtimeEventEnvelopeSchema.parse(value);
}

export function isRuntimeEventType(value: string): value is RuntimeEventType {
  return RUNTIME_EVENT_TYPES.some((eventType) => eventType === value);
}

export function parseRuntimeEventPayload(type: string, payload: unknown): RuntimeEventPayload {
  if (!isRuntimeEventType(type)) throw new Error(`UNKNOWN_RUNTIME_EVENT_TYPE: ${type}`);
  return RUNTIME_EVENT_PAYLOAD_SCHEMAS[type].parse(payload) as RuntimeEventPayload;
}

export function parseDurableInterruptManifest(value: unknown): DurableInterruptManifest {
  return durableInterruptManifestSchema.parse(value);
}

interface SequenceEntry { sequence: number; touchedAt: number }
export interface RunSequenceAllocatorOptions { ttlMs?: number; maxEntries?: number; now?: () => number }

export class RunSequenceAllocator {
  private readonly entries = new Map<string, SequenceEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: RunSequenceAllocatorOptions = {}) {
    this.ttlMs = requirePositiveInteger(options.ttlMs ?? 30 * 60 * 1_000, "ttlMs");
    this.maxEntries = requirePositiveInteger(options.maxEntries ?? 10_000, "maxEntries");
    this.now = options.now ?? Date.now;
  }

  get size(): number { return this.entries.size }

  next(runId: string): number {
    requireOpaqueId(runId, "runId");
    this.sweepExpired();
    const current = this.entries.get(runId);
    if (!current && this.entries.size >= this.maxEntries) this.evictLeastRecentlyUsed();
    const sequence = (current?.sequence ?? 0) + 1;
    if (!Number.isSafeInteger(sequence)) throw new Error(`Sequence exhausted for run: ${runId}`);
    this.entries.set(runId, { sequence, touchedAt: this.now() });
    return sequence;
  }

  seed(runId: string, maxPersistedSequence: number): void {
    requireOpaqueId(runId, "runId");
    requireNonNegativeInteger(maxPersistedSequence, "maxPersistedSequence");
    this.sweepExpired();
    const current = this.entries.get(runId);
    if (current && maxPersistedSequence < current.sequence) throw new Error("Persisted sequence is below current sequence");
    if (!current && this.entries.size >= this.maxEntries) this.evictLeastRecentlyUsed();
    this.entries.set(runId, { sequence: maxPersistedSequence, touchedAt: this.now() });
  }

  release(runId: string): boolean { requireOpaqueId(runId, "runId"); return this.entries.delete(runId) }

  sweepExpired(): number {
    const expiredBefore = this.now() - this.ttlMs;
    let removed = 0;
    for (const [runId, entry] of this.entries) {
      if (entry.touchedAt < expiredBefore) { this.entries.delete(runId); removed += 1; }
    }
    return removed;
  }

  private evictLeastRecentlyUsed(): void {
    let selectedRunId: string | undefined;
    let selectedTime = Number.POSITIVE_INFINITY;
    for (const [runId, entry] of this.entries) {
      if (entry.touchedAt < selectedTime) { selectedRunId = runId; selectedTime = entry.touchedAt; }
    }
    if (selectedRunId) this.entries.delete(selectedRunId);
  }
}

export function stableEventId(persistedEventId?: string, createEventId: () => string = () => globalThis.crypto.randomUUID()): string {
  const eventId = persistedEventId ?? createEventId();
  requireOpaqueId(eventId, "eventId");
  return eventId;
}

export function requireOpaqueId(value: string, field: string): void {
  if (value.trim() === "" || value.length > 256) throw new Error(`Invalid ${field}`);
}

function requirePositiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`);
  return value;
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
}
