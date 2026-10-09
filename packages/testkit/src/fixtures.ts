import {
  RUNTIME_EVENT_SCHEMA_VERSION,
  executionContextSchema,
  runtimeEventEnvelopeSchema,
  type AgentTask,
  type ExecutionContext,
  type PrincipalContext,
  type RuntimeEventEnvelope,
  type RuntimeScope,
} from "@gun-ai/harness-contracts";
import { stableEventId } from "@gun-ai/harness-kernel";

export type ExecutionContextFixtureOverrides = Partial<
  Omit<ExecutionContext, "principal" | "scope">
> & {
  principal?: Partial<PrincipalContext>;
  scope?: Partial<RuntimeScope>;
};

export function createExecutionContextFixture(overrides: ExecutionContextFixtureOverrides = {}): ExecutionContext {
  const principal: PrincipalContext = {
    principalId: "principal-1",
    principalType: "user",
    principalKind: "authenticated",
    tenantId: "tenant-1",
    roles: ["member"],
    scopes: ["chat:use"],
    authSource: "trusted_gateway",
    authenticatedAt: "2026-10-04T00:00:00.000Z",
    ...overrides.principal,
  };
  const scope: RuntimeScope = {
    scopeId: "scope-1",
    scopeType: "tenant",
    tenantId: principal.tenantId,
    ...overrides.scope,
  };
  return executionContextSchema.parse({
    requestId: "request-1",
    threadId: "thread-1",
    runId: "run-1",
    taskId: "task-1",
    attempt: 1,
    ...overrides,
    principal,
    scope,
  });
}

export function createTaskFixture(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    taskId: "task-1",
    taskType: "fixture",
    status: "created",
    steps: [],
    metadata: {},
    createdAt: "2026-10-04T00:00:00.000Z",
    updatedAt: "2026-10-04T00:00:00.000Z",
    ...overrides,
  };
}

export interface RuntimeEventEnvelopeFixtureInput<TPayload> {
  context?: ExecutionContext;
  payload: TPayload;
  type?: string;
  eventId?: string;
  sequence?: number;
  emittedAt?: string;
}

export function createRuntimeEventEnvelopeFixture<TPayload>(
  input: RuntimeEventEnvelopeFixtureInput<TPayload>
): RuntimeEventEnvelope<string, TPayload> {
  const context = input.context ?? createExecutionContextFixture();
  const envelope: RuntimeEventEnvelope<string, TPayload> = {
    schemaVersion: RUNTIME_EVENT_SCHEMA_VERSION,
    eventId: stableEventId(input.eventId, () => "event-1"),
    sequence: input.sequence ?? 1,
    type: input.type ?? "run.started",
    emittedAt: input.emittedAt ?? "2026-10-04T00:00:00.000Z",
    context: {
      requestId: context.requestId,
      threadId: context.threadId,
      runId: context.runId,
      taskId: context.taskId,
      ...(context.stepId ? { stepId: context.stepId } : {}),
      ...(context.toolCallId ? { toolCallId: context.toolCallId } : {}),
      ...(context.toolExecutionId ? { toolExecutionId: context.toolExecutionId } : {}),
      ...(context.parentRunId ? { parentRunId: context.parentRunId } : {}),
      ...(context.agentId ? { agentId: context.agentId } : {}),
      attempt: context.attempt,
      principalId: context.principal.principalId,
      tenantId: context.principal.tenantId,
      scopeId: context.scope.scopeId,
      scopeType: context.scope.scopeType,
    },
    payload: input.payload,
  };
  runtimeEventEnvelopeSchema.parse(envelope);
  return envelope;
}
