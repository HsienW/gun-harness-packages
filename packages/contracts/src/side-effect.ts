import { z } from "zod";

import type { ExecutionContext, RuntimeScope } from "./identity.js";

type BrandedString<TBrand extends string> = string & { readonly __brand: TBrand };
export type ReplayKey = BrandedString<"ReplayKey">;
export type ToolExecutionAttemptId = BrandedString<"ToolExecutionAttemptId">;
export type BusinessEffectKey = BrandedString<"BusinessEffectKey">;
export type RequestDedupKey = BrandedString<"RequestDedupKey">;

export interface TrustedScope { scopeId: string; tenantId: string; principalId: string }
export interface ReplayIdentityInput {
  runId: string;
  stepId: string;
  logicalToolCallId?: string;
  toolCallId?: string;
  callIndex: number;
  toolName: string;
  toolVersion: string;
  attempt?: number;
}
export interface ToolExecutionAttemptIdentity {
  toolExecutionAttemptId: ToolExecutionAttemptId;
  toolExecutionId: string;
  executionAttempt: number;
}
export interface RequestDedupIdentityInput { tenantId: string; principalId: string; routeNamespace: string; clientKey: string }

export interface IdempotencyKey { namespace: string; resourceKey: string; version: string }
export type IdempotencyStatus = "locked" | "completed" | "failed";
export const IDEMPOTENCY_RECORD_SCHEMA_VERSION = "1.0" as const;
export interface IdempotencyRecord {
  schemaVersion: typeof IDEMPOTENCY_RECORD_SCHEMA_VERSION;
  key: string;
  status: IdempotencyStatus;
  result?: unknown;
  createdAt: string;
  expiresAt: string;
}

export const AUTHORIZATION_CONFIRMATION_SCHEMA_VERSION = "1.0" as const;
const identifierSchema = z.string().trim().min(1).max(256);
const approvalIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
const resourceSchema = z.object({
  resourceType: identifierSchema,
  resourceId: identifierSchema,
  tenantId: identifierSchema,
  ownerScopeId: identifierSchema.optional(),
}).strict();
const scopeSchema: z.ZodType<Pick<RuntimeScope, "scopeId" | "scopeType" | "tenantId">> = z.object({
  scopeId: identifierSchema,
  scopeType: z.enum(["principal", "tenant", "team", "conversation"]),
  tenantId: identifierSchema,
}).strict();
const confirmationResumeCompatibilitySchema = z.object({
  type: z.literal("tool_authorization_confirmation"),
  schemaVersion: z.literal(AUTHORIZATION_CONFIRMATION_SCHEMA_VERSION),
  decisions: z.tuple([z.literal("approve"), z.literal("deny")]),
}).strict();

export const confirmationRequiredDescriptorSchema = z.object({
  type: z.literal("confirmation_required"),
  schemaVersion: z.literal(AUTHORIZATION_CONFIRMATION_SCHEMA_VERSION),
  decisionId: identifierSchema,
  approvalId: approvalIdSchema,
  requestId: identifierSchema,
  threadId: identifierSchema,
  runId: identifierSchema,
  taskId: identifierSchema,
  stepId: identifierSchema.optional(),
  toolCallId: identifierSchema.optional(),
  scope: scopeSchema,
  resource: resourceSchema,
  policyVersion: identifierSchema,
  expiresAt: z.string().datetime(),
  allowedApproverPrincipalIds: z.array(identifierSchema).min(1),
  resumeCompatibility: confirmationResumeCompatibilitySchema,
  summary: z.object({
    toolName: identifierSchema,
    action: identifierSchema,
    resourceType: identifierSchema,
  }).strict(),
}).strict();
export type ConfirmationRequiredDescriptor = z.infer<typeof confirmationRequiredDescriptorSchema>;

export const confirmationResumeSchema = z.object({
  type: z.literal("tool_authorization_confirmation"),
  schemaVersion: z.literal(AUTHORIZATION_CONFIRMATION_SCHEMA_VERSION),
  approvalId: approvalIdSchema,
  decisionId: identifierSchema,
  decision: z.enum(["approve", "deny"]),
}).strict();
export type ConfirmationResume = z.infer<typeof confirmationResumeSchema>;

export const confirmationInterruptPayloadSchema = z.object({
  type: z.literal("tool_authorization_confirmation"),
  schemaVersion: z.literal(AUTHORIZATION_CONFIRMATION_SCHEMA_VERSION),
  approvalId: approvalIdSchema,
  decisionId: identifierSchema,
  expiresAt: z.string().datetime(),
  resumeCompatibility: confirmationResumeCompatibilitySchema,
  summary: confirmationRequiredDescriptorSchema.shape.summary,
}).strict();
export type ConfirmationInterruptPayload = z.infer<typeof confirmationInterruptPayloadSchema>;

export type ConfirmationConsumeFailureReason =
  | "CONFIRMATION_BINDING_MISMATCH" | "CONFIRMATION_TIMEOUT"
  | "CONFIRMATION_REPLAYED_OR_EXPIRED";
export type ConfirmationConsumeResult =
  | { ok: true; status: "approved" | "denied" }
  | { ok: false; reasonCode: ConfirmationConsumeFailureReason };

export type DispatchState = "before" | "after" | "unknown";
type GovernedToolOutcome<TResult> =
  | { type: "succeeded"; result: TResult }
  | { type: "rejected_before_dispatch"; errorCode: string }
  | { type: "denied_by_authorization"; errorCode: string; decisionId: string }
  | { type: "confirmation_required"; decisionId: string; descriptor: ConfirmationRequiredDescriptor }
  | { type: "failed_not_committed"; errorCode: string; retryAfterMs?: number }
  | { type: "ambiguous_after_dispatch"; errorCode: string }
  | { type: "cancelled"; dispatchState: DispatchState };

export type ToolExecutionTerminationCause =
  | "completed" | "rejected_before_dispatch" | "denied_by_authorization"
  | "confirmation_required" | "failed_not_committed" | "ambiguous_after_dispatch"
  | "cancelled_before_dispatch" | "cancelled_after_dispatch"
  | "cancelled_unknown_dispatch" | "profile_missing"
  | "profile_version_unsupported" | "profile_invalid" | "unsupported"
  | "capability_mismatch" | "secret_unresolvable";

export type GovernedAuthorizationOutcome =
  | { type: "authorized"; decisionId?: string }
  | Extract<GovernedToolOutcome<never>, { type: "denied_by_authorization" | "confirmation_required" }>;

export interface ConfirmationDescriptorInput {
  decisionId: string;
  executionContext: ExecutionContext;
}
