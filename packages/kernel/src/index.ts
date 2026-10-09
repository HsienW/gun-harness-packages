/** Deterministic authorization primitives. @since 0.1.0 */
export { isActiveScopePresent, isScopeCompatible, projectTrustedScope, scopeTenantMatches } from "./authorization.js";

/** Deterministic retry and failure primitives. @since 0.1.0 */
export { checkBudget, classifyError, computeBackoff, createBudget, recordAttempt } from "./retry.js";

/** Injected side-effect identity primitives. @since 0.1.0 */
export { createReplayKey, createRequestDedupKey, createToolExecutionAttemptIdentity, hashBusinessEffectKey } from "./side-effect.js";
export type { HashPort, RandomUuidPort } from "./side-effect.js";

/** Stable idempotency serialization. @since 0.1.0 */
export { parseKey, serializeKey } from "./idempotency.js";

/** Versioned event and recovery parsing. @since 0.1.0 */
export {
  RunSequenceAllocator,
  isRuntimeEventType,
  parseDurableInterruptManifest,
  parseRuntimeEventEnvelope,
  parseRuntimeEventPayload,
  parseRuntimeEventSchemaVersion,
  requireOpaqueId,
  stableEventId,
} from "./events.js";
export type { RunSequenceAllocatorOptions } from "./events.js";

/** Serialized-contract compatibility. @since 0.1.0 */
export {
  RuntimeVersionCompatibilityError,
  assertResumeVersionCompatible,
  evaluateRuntimeVersionCompatibility,
} from "./version-compatibility.js";
export type { RuntimeVersionSet, VersionCompatibility } from "./version-compatibility.js";
