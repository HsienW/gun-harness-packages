import { z } from "zod";

import type { RetryPolicy } from "./retry.js";
import type { BusinessEffectKey, TrustedScope } from "./side-effect.js";

type ToolRiskTier = "read" | "write" | "sensitive" | "communication";
interface ResultReference { resultHash: string; payloadRef: string; externalSystemNamespace?: string; externalOperationId?: string }
interface ResultReferencePolicy<TResult> {
  toResultRef(result: TResult): ResultReference;
  resolveResultRef(payloadRef: string): Promise<TResult | null>;
  isReusable(cacheState: "reusable" | "expired" | "invalidated" | "authorization_mismatch" | "version_mismatch", scope: TrustedScope, toolVersion: string): boolean;
}
type ReconciliationResult<TResult> =
  | { state: "committed"; result?: TResult }
  | { state: "not_committed" }
  | { state: "unknown"; reason?: string };
interface SideEffectToolDescriptor<TInput, TResult> {
  toolName: string;
  toolVersion: string;
  deriveBusinessEffectKey(input: TInput, scope: TrustedScope): string;
  reconcile?: { reconcile(input: { toolExecutionId: string; externalOperationId?: string; businessEffectKey: BusinessEffectKey }): Promise<ReconciliationResult<TResult>> };
  resultReferencePolicy: ResultReferencePolicy<TResult>;
}
interface ExecutionProfileReference { profileId: string; profileVersion: "1.0" }
interface EgressRequirements { destinations: string[]; protocols: ("http" | "https")[] }
interface SecretReference { secretRef: string; secretName: string; scope: string; lease?: { leaseId?: string; expiresAt: string } }

export interface RuntimeSchemaParseSuccess<TValue> { success: true; data: TValue }
export interface RuntimeSchemaParseFailure { success: false; error: unknown }
export interface RuntimeSchema<TValue> {
  safeParse(value: unknown): RuntimeSchemaParseSuccess<TValue> | RuntimeSchemaParseFailure;
}
export interface TimeoutPolicy { timeoutMs: number }
export interface ToolRateLimitPolicy { maxRequestsPerWindow: number; windowMs: number }
export interface ToolCircuitBreakerPolicy { failureThreshold: number; successThreshold: number; resetTimeoutMs: number; halfOpenMaxProbes: number }
export type InterruptBehavior = "cancel_safe" | "finish_current" | "reconcile_first";
export interface RuntimeToolDescriptor<TInput = unknown, TOutput = unknown> {
  toolName: string;
  toolVersion: string;
  inputSchema: RuntimeSchema<TInput>;
  outputSchema: RuntimeSchema<TOutput>;
  riskTier: ToolRiskTier;
  isReadOnly: boolean;
  isConcurrencySafe(input: TInput): boolean;
  timeoutPolicy: TimeoutPolicy;
  retryPolicy: RetryPolicy;
  rateLimitPolicy?: ToolRateLimitPolicy;
  circuitBreakerPolicy?: ToolCircuitBreakerPolicy;
  interruptBehavior: InterruptBehavior;
  executionProfileRef?: ExecutionProfileReference;
  egressRequirements?: EgressRequirements;
  secretRequirements?: readonly SecretReference[];
  sideEffect?: SideEffectToolDescriptor<TInput, TOutput>;
}
export interface RuntimeToolIdentity { toolName: string; toolVersion: string }

const governedToolOutcomeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("succeeded"), result: z.unknown() }).strict(),
  z.object({ type: z.literal("rejected_before_dispatch"), errorCode: z.string().min(1) }).strict(),
  z.object({ type: z.literal("denied_by_authorization"), errorCode: z.string().min(1), decisionId: z.string().min(1) }).strict(),
  z.object({ type: z.literal("confirmation_required"), decisionId: z.string().min(1), descriptor: z.unknown() }).strict(),
  z.object({ type: z.literal("failed_not_committed"), errorCode: z.string().min(1) }).strict(),
  z.object({ type: z.literal("ambiguous_after_dispatch"), errorCode: z.string().min(1) }).strict(),
  z.object({ type: z.literal("cancelled"), dispatchState: z.enum(["before", "after", "unknown"]) }).strict(),
]);

export const structuredToolResultEnvelopeSchema = z.object({
  schemaVersion: z.literal("1.0"),
  kind: z.literal("tool_result"),
  correlation: z.object({
    requestId: z.string().min(1),
    threadId: z.string().min(1),
    runId: z.string().min(1),
    toolCallId: z.string().min(1),
    stepId: z.string().min(1).optional(),
  }).strict(),
  tool: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    riskTier: z.enum(["read", "write", "sensitive", "communication"]),
    readOnly: z.boolean(),
  }).strict(),
  outcome: governedToolOutcomeSchema,
  executionProfileVersion: z.string().min(1).nullable().optional(),
  effectiveCapabilities: z.record(z.unknown()).nullable().optional(),
  secretRefsUsed: z.array(z.string()).nullable().optional(),
  egressDecision: z.object({ decision: z.enum(["allow", "deny"]), reasonCode: z.string() }).strict().nullable().optional(),
  terminationCause: z.string().nullable().optional(),
  emittedAt: z.string().datetime(),
}).strict();

type GovernedOutcome<TResult> =
  | { type: "succeeded"; result: TResult }
  | { type: "rejected_before_dispatch"; errorCode: string }
  | { type: "denied_by_authorization"; errorCode: string; decisionId: string }
  | { type: "confirmation_required"; decisionId: string; descriptor: unknown }
  | { type: "failed_not_committed"; errorCode: string; retryAfterMs?: number }
  | { type: "ambiguous_after_dispatch"; errorCode: string }
  | { type: "cancelled"; dispatchState: "before" | "after" | "unknown" };

interface EffectiveCapabilitiesShape {
  executionMode: "trusted_in_process" | "isolated_process";
  processIsolation?: boolean;
  filesystemIsolation?: boolean;
  egressIsolation?: boolean;
  resourceLimits?: boolean;
}

export interface StructuredToolResultEnvelope<TResult = unknown> {
  schemaVersion: "1.0";
  kind: "tool_result";
  correlation: { requestId: string; threadId: string; runId: string; toolCallId: string; stepId?: string };
  tool: { name: string; version: string; riskTier: RuntimeToolDescriptor["riskTier"]; readOnly: boolean };
  outcome: GovernedOutcome<TResult>;
  executionProfileVersion?: string | null;
  effectiveCapabilities?: EffectiveCapabilitiesShape | null;
  secretRefsUsed?: string[] | null;
  egressDecision?: { decision: "allow" | "deny"; reasonCode: string } | null;
  terminationCause?: string | null;
  emittedAt: string;
}
