import type {
  BusinessEffectKey,
  ReplayIdentityInput,
  ReplayKey,
  RequestDedupIdentityInput,
  RequestDedupKey,
  ToolExecutionAttemptId,
  ToolExecutionAttemptIdentity,
} from "@gun-ai/harness-contracts";

export interface HashPort { hash(values: readonly string[]): string }
export interface RandomUuidPort { randomUUID(): string }

function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) throw new Error(`${fieldName} must not be empty`);
}

export function createReplayKey(input: ReplayIdentityInput, dependencies: HashPort): ReplayKey {
  const logicalToolCallId = input.logicalToolCallId ?? input.toolCallId;
  if (!logicalToolCallId) throw new Error("logicalToolCallId or toolCallId is required");
  if (!Number.isSafeInteger(input.callIndex) || input.callIndex < 0) throw new Error("callIndex must be a non-negative safe integer");
  const components = [input.runId, input.stepId, logicalToolCallId, String(input.callIndex), input.toolName, input.toolVersion] as const;
  components.forEach((value, index) => assertNonEmpty(value, `replay identity component ${index}`));
  return dependencies.hash(components) as ReplayKey;
}

export function createToolExecutionAttemptIdentity(
  input: { toolExecutionId: string; executionAttempt: number },
  dependencies: RandomUuidPort
): ToolExecutionAttemptIdentity {
  assertNonEmpty(input.toolExecutionId, "toolExecutionId");
  if (!Number.isSafeInteger(input.executionAttempt) || input.executionAttempt < 1) {
    throw new Error("executionAttempt must be a positive safe integer");
  }
  return {
    toolExecutionAttemptId: dependencies.randomUUID() as ToolExecutionAttemptId,
    toolExecutionId: input.toolExecutionId,
    executionAttempt: input.executionAttempt,
  };
}

export function hashBusinessEffectKey(rawKey: string, dependencies: HashPort): BusinessEffectKey {
  assertNonEmpty(rawKey, "businessEffectKey");
  return dependencies.hash([rawKey]) as BusinessEffectKey;
}

export function createRequestDedupKey(input: RequestDedupIdentityInput, dependencies: HashPort): RequestDedupKey {
  const components = [input.tenantId, input.principalId, input.routeNamespace, input.clientKey] as const;
  components.forEach((value, index) => assertNonEmpty(value, `request dedup identity component ${index}`));
  return dependencies.hash(components) as RequestDedupKey;
}
