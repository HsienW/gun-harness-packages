import { z } from "zod";

/** @since 0.1.0 */
export const PRINCIPAL_TYPES = [
  "user", "merchant_staff", "platform_staff", "service",
] as const;

/** @since 0.1.0 */
export const AUTH_SOURCES = [
  "trusted_gateway", "oidc", "service_token", "development",
] as const;

export type PrincipalType = (typeof PRINCIPAL_TYPES)[number];
export type AuthSource = (typeof AUTH_SOURCES)[number];

/** @since 0.1.0 */
export const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
export const opaqueIdentityIdSchema = z.string().min(1).max(128).regex(OPAQUE_ID_PATTERN);

export const ACCOUNT_STATUS_VALUES = [
  "pending_verification", "active", "recovery_restricted", "suspended",
  "deletion_pending", "deleted",
] as const;
export const SESSION_STATUS_VALUES = [
  "active", "expired", "revoked", "compromised",
] as const;
export const PRINCIPAL_KIND_VALUES = [
  "anonymous", "authenticated", "service", "operator", "delegated",
] as const;

export const accountStatusSchema = z.enum(ACCOUNT_STATUS_VALUES);
export const sessionStatusSchema = z.enum(SESSION_STATUS_VALUES);
export const principalKindSchema = z.enum(PRINCIPAL_KIND_VALUES);

export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type PrincipalKind = z.infer<typeof principalKindSchema>;

export const delegatedIdentitySchema = z.object({
  delegatedPrincipalId: opaqueIdentityIdSchema,
  parentPrincipalId: opaqueIdentityIdSchema,
  delegatedCapabilitySet: z.array(z.string().min(1).max(128)).min(1).max(64),
}).strict();

export type DelegatedIdentity = z.infer<typeof delegatedIdentitySchema>;

export const PRINCIPAL_TYPE_TO_KIND = {
  user: "authenticated",
  merchant_staff: "authenticated",
  platform_staff: "operator",
  service: "service",
} as const satisfies Readonly<Record<PrincipalType, PrincipalKind>>;

export const principalTypeAdapter = {
  version: "1.0.0" as const,
  mapping: PRINCIPAL_TYPE_TO_KIND,
  toPrincipalKind(value: string): PrincipalKind {
    if (!(value in PRINCIPAL_TYPE_TO_KIND)) {
      const error = new Error("UNKNOWN_PRINCIPAL_TYPE");
      Object.defineProperty(error, "code", {
        enumerable: true,
        value: "UNKNOWN_PRINCIPAL_TYPE",
      });
      throw error;
    }
    return PRINCIPAL_TYPE_TO_KIND[value as keyof typeof PRINCIPAL_TYPE_TO_KIND];
  },
} as const;

export interface PrincipalContext {
  principalId: string;
  principalType: PrincipalType;
  principalKind?: PrincipalKind;
  tenantId: string;
  accountId?: string;
  sessionId?: string;
  deviceId?: string;
  roles: string[];
  scopes: string[];
  authSource: AuthSource;
  authenticatedAt: string;
}

export const SCOPE_TYPES = [
  "principal", "tenant", "team", "conversation",
] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export interface RuntimeScope {
  scopeId: string;
  scopeType: ScopeType;
  tenantId: string;
  ownerPrincipalId?: string;
}

export interface TrustedScopeProjection {
  scopeId: string;
  tenantId: string;
  principalId: string;
}

export interface ProjectedTrustedScope {
  principalId: string;
  scope: RuntimeScope;
}

export interface PrincipalScopeIdentity { principalId: string }
export interface StoredScopeIdentity { scopeId: string; tenantId: string; principalId: string }

export interface ExecutionContext {
  requestId: string;
  threadId: string;
  runId: string;
  taskId: string;
  stepId?: string;
  toolCallId?: string;
  toolExecutionId?: string;
  parentRunId?: string;
  agentId?: string;
  attempt: number;
  accountId?: string;
  sessionId?: string;
  deviceId?: string;
  principalKind?: PrincipalKind;
  principal: PrincipalContext;
  scope: RuntimeScope;
}

export type ExecutionCorrelation = Partial<Pick<ExecutionContext,
  "requestId" | "threadId" | "runId" | "taskId" | "stepId" |
  "toolCallId" | "toolExecutionId" | "parentRunId" | "agentId"
>> & {
  accountId?: string;
  tenantId?: string;
  principalId?: string;
  sessionId?: string;
};

export const executionIdSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9_\-:.]+$/);

const principalContextSchema = z.object({
  principalId: z.string().min(1),
  principalType: z.enum(PRINCIPAL_TYPES),
  principalKind: principalKindSchema.optional(),
  tenantId: z.string().min(1),
  accountId: opaqueIdentityIdSchema.optional(),
  sessionId: opaqueIdentityIdSchema.optional(),
  deviceId: opaqueIdentityIdSchema.optional(),
  roles: z.array(z.string().min(1)),
  scopes: z.array(z.string().min(1)),
  authSource: z.enum(AUTH_SOURCES),
  authenticatedAt: z.string().datetime(),
}).strict();

const runtimeScopeSchema = z.object({
  scopeId: z.string().min(1),
  scopeType: z.enum(SCOPE_TYPES),
  tenantId: z.string().min(1),
  ownerPrincipalId: z.string().min(1).optional(),
}).strict();

export const executionContextSchema: z.ZodType<ExecutionContext> = z.object({
  requestId: executionIdSchema,
  threadId: executionIdSchema,
  runId: executionIdSchema,
  taskId: executionIdSchema,
  stepId: executionIdSchema.optional(),
  toolCallId: executionIdSchema.optional(),
  toolExecutionId: executionIdSchema.optional(),
  parentRunId: executionIdSchema.optional(),
  agentId: executionIdSchema.optional(),
  attempt: z.number().int().positive(),
  accountId: opaqueIdentityIdSchema.optional(),
  sessionId: opaqueIdentityIdSchema.optional(),
  deviceId: opaqueIdentityIdSchema.optional(),
  principalKind: principalKindSchema.optional(),
  principal: principalContextSchema,
  scope: runtimeScopeSchema,
}).strict().refine(
  (context) => context.principal.tenantId === context.scope.tenantId,
  { message: "Principal and scope tenant identities must match", path: ["scope", "tenantId"] }
);
