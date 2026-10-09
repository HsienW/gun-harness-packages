import type { PrincipalContext, RuntimeScope } from "./identity.js";

export const AUTHORIZATION_EFFECTS = ["allow", "deny", "require_confirmation"] as const;
export type AuthorizationEffect = (typeof AUTHORIZATION_EFFECTS)[number];

export const AUTHORIZATION_REASON_CODES = [
  "POLICY_ALLOWED", "EXPLICIT_GRANT_ALLOWED", "CROSS_TENANT_DENIED",
  "MISSING_ACTIVE_SCOPE", "SCOPE_NOT_VISIBLE", "SCOPE_NOT_WRITABLE",
  "ACTION_NOT_ALLOWED", "MISSING_ROLE_SCOPE_GRANT",
  "RESOURCE_OWNERSHIP_MISMATCH", "CONTEXT_LIMIT_EXCEEDED",
  "TOOL_RISK_DENIED", "REQUIRES_CONFIRMATION", "CONFIRMATION_APPROVED",
  "CONFIRMATION_TIMEOUT", "CONFIRMATION_CANCELLED", "AUTHORIZATION_UNAVAILABLE",
] as const;
export type AuthorizationReasonCode = (typeof AUTHORIZATION_REASON_CODES)[number];

interface ResourceRefShape {
  resourceType: string;
  resourceId: string;
  tenantId: string;
  accountId?: string;
  ownerScopeId?: string;
}

export interface AuthorizationRequest {
  principal: PrincipalContext;
  scope: RuntimeScope;
  action: string;
  resource: ResourceRefShape;
  context?: Record<string, unknown>;
}

export interface AuthorizationDecision {
  decisionId: string;
  effect: AuthorizationEffect;
  reasonCode: AuthorizationReasonCode;
  matchedPolicy?: string;
  matchedGrantId?: string;
  createdAt: string;
}

export type ScopeAccess = "none" | "visible" | "writable";
export type PolicyEffect = "allow" | "deny" | "require_confirmation";

export interface AuthorizationPolicy {
  policyId: string;
  actions: readonly string[];
  access: "read" | "write";
  allowedRoles?: readonly string[];
  allowedPrincipalScopes?: readonly string[];
  evaluateContext?: (context: Readonly<Record<string, unknown>> | undefined) => PolicyEffect;
}
