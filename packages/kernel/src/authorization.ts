import type {
  PrincipalScopeIdentity,
  ProjectedTrustedScope,
  RuntimeScope,
  ScopeType,
  StoredScopeIdentity,
  TrustedScopeProjection,
} from "@gun-ai/harness-contracts";

export function isActiveScopePresent(scope: RuntimeScope | null | undefined): scope is RuntimeScope {
  return scope !== null && scope !== undefined && scope.scopeId.trim().length > 0;
}

export function scopeTenantMatches(scope: RuntimeScope, resourceTenant: string): boolean {
  const scopeTenant = scope.tenantId.trim();
  const normalizedResourceTenant = resourceTenant.trim();
  return scopeTenant.length > 0 && normalizedResourceTenant.length > 0 && scopeTenant === normalizedResourceTenant;
}

export function projectTrustedScope(trustedScope: TrustedScopeProjection, scopeType: ScopeType): ProjectedTrustedScope {
  return {
    principalId: trustedScope.principalId,
    scope: { scopeId: trustedScope.scopeId, scopeType, tenantId: trustedScope.tenantId },
  };
}

export function isScopeCompatible(
  scope: Pick<RuntimeScope, "scopeId" | "tenantId">,
  principal: PrincipalScopeIdentity,
  recordScope: StoredScopeIdentity
): boolean {
  return scope.scopeId === recordScope.scopeId &&
    scope.tenantId === recordScope.tenantId &&
    principal.principalId === recordScope.principalId;
}
