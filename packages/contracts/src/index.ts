/** Stable lifecycle domain constants. @since 0.1.0 */
export {
  RUN_TERMINAL_STATUSES,
  RUN_WAITING_STATUSES,
  STEP_STATUSES,
  TASK_EVENT_TYPES,
  TASK_STATUSES,
} from "./lifecycle.js";
export type {
  AgentStep,
  AgentTask,
  RunStatus,
  RunStatusTransition,
  RunTerminalStatus,
  RunWaitingStatus,
  StepError,
  StepStatus,
  TaskEvent,
  TaskEventType,
  TaskStatus,
  TransitionResult,
} from "./lifecycle.js";

/** Stable execution and authorization identity contracts. @since 0.1.0 */
export {
  ACCOUNT_STATUS_VALUES,
  AUTH_SOURCES,
  OPAQUE_ID_PATTERN,
  PRINCIPAL_KIND_VALUES,
  PRINCIPAL_TYPES,
  PRINCIPAL_TYPE_TO_KIND,
  SCOPE_TYPES,
  SESSION_STATUS_VALUES,
  accountStatusSchema,
  delegatedIdentitySchema,
  executionContextSchema,
  executionIdSchema,
  opaqueIdentityIdSchema,
  principalKindSchema,
  principalTypeAdapter,
  sessionStatusSchema,
} from "./identity.js";
export type {
  AccountStatus,
  AuthSource,
  DelegatedIdentity,
  ExecutionContext,
  ExecutionCorrelation,
  PrincipalContext,
  PrincipalKind,
  PrincipalScopeIdentity,
  PrincipalType,
  ProjectedTrustedScope,
  RuntimeScope,
  ScopeType,
  SessionStatus,
  StoredScopeIdentity,
  TrustedScopeProjection,
} from "./identity.js";

/** Stable authorization decision contracts. @since 0.1.0 */
export { AUTHORIZATION_EFFECTS, AUTHORIZATION_REASON_CODES } from "./authorization.js";
export type {
  AuthorizationDecision,
  AuthorizationEffect,
  AuthorizationPolicy,
  AuthorizationReasonCode,
  AuthorizationRequest,
  PolicyEffect,
  ScopeAccess,
} from "./authorization.js";

/** Stable retry and failure contracts. @since 0.1.0 */
export type {
  BackoffOptions,
  BackoffStrategy,
  BudgetCheckResult,
  BudgetExhaustionReason,
  ClassifiedError,
  ErrorCategory,
  ErrorClassificationContext,
  RetryBudget,
  RetryPolicy,
} from "./retry.js";

/** Stable side-effect, idempotency, approval, and terminal contracts. @since 0.1.0 */
export {
  AUTHORIZATION_CONFIRMATION_SCHEMA_VERSION,
  IDEMPOTENCY_RECORD_SCHEMA_VERSION,
  confirmationInterruptPayloadSchema,
  confirmationRequiredDescriptorSchema,
  confirmationResumeSchema,
} from "./side-effect.js";
export type {
  BusinessEffectKey,
  ConfirmationConsumeFailureReason,
  ConfirmationConsumeResult,
  ConfirmationInterruptPayload,
  ConfirmationRequiredDescriptor,
  ConfirmationResume,
  DispatchState,
  GovernedAuthorizationOutcome,
  IdempotencyKey,
  IdempotencyRecord,
  IdempotencyStatus,
  ReplayIdentityInput,
  ReplayKey,
  RequestDedupIdentityInput,
  RequestDedupKey,
  ToolExecutionAttemptId,
  ToolExecutionAttemptIdentity,
  ToolExecutionTerminationCause,
  TrustedScope,
} from "./side-effect.js";

/** Stable versioned runtime event contracts. @since 0.1.0 */
export {
  RUNTIME_EVENT_PAYLOAD_SCHEMAS,
  RUNTIME_EVENT_SCHEMA_VERSION,
  RUNTIME_EVENT_TYPES,
  executionEventContextSchema,
  runtimeEventEnvelopeSchema,
} from "./events.js";
export type {
  ExecutionEventContext,
  JsonValue,
  RuntimeEventEnvelope,
  RuntimeEventPayload,
  RuntimeEventSchemaVersion,
  RuntimeEventType,
} from "./events.js";

/** Stable checkpoint and resume manifest contracts. @since 0.1.0 */
export {
  INTERRUPT_MANIFEST_STATUSES,
  durableInterruptManifestSchema,
  executionManifestRefSchema,
} from "./recovery.js";
export type {
  DurableInterruptManifest,
  ExecutionManifestRef,
  InterruptManifestStatus,
} from "./recovery.js";

/** Stable tool descriptor and structured-result contracts. @since 0.1.0 */
export { structuredToolResultEnvelopeSchema } from "./tool.js";
export type {
  InterruptBehavior,
  RuntimeSchema,
  RuntimeSchemaParseFailure,
  RuntimeSchemaParseSuccess,
  RuntimeToolDescriptor,
  RuntimeToolIdentity,
  StructuredToolResultEnvelope,
  TimeoutPolicy,
  ToolCircuitBreakerPolicy,
  ToolRateLimitPolicy,
} from "./tool.js";
