import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  executionContextSchema,
  executionIdSchema,
  runtimeEventEnvelopeSchema,
} from "./index.js";

const canonicalExecutionContext = {
  requestId: "request-1",
  threadId: "thread-1",
  runId: "run-1",
  taskId: "task-1",
  attempt: 1,
  principal: {
    principalId: "user-1",
    principalType: "user" as const,
    principalKind: "authenticated" as const,
    tenantId: "tenant-1",
    roles: ["member"],
    scopes: ["chat:use"],
    authSource: "trusted_gateway" as const,
    authenticatedAt: "2026-10-05T00:00:00.000Z",
  },
  scope: {
    scopeId: "scope-1",
    scopeType: "tenant" as const,
    tenantId: "tenant-1",
  },
};

describe("executionContextSchema", () => {
  it("accepts a complete canonical v4 execution context", () => {
    assert.equal(executionContextSchema.safeParse(canonicalExecutionContext).success, true);
  });

  it("rejects a cross-tenant execution context", () => {
    const result = executionContextSchema.safeParse({
      ...canonicalExecutionContext,
      scope: { ...canonicalExecutionContext.scope, tenantId: "tenant-2" },
    });
    assert.equal(result.success, false);
  });
});

describe("contract boundary schemas", () => {
  it("rejects whitespace and path-like execution identifiers", () => {
    assert.equal(executionIdSchema.safeParse("../run 1").success, false);
  });

  it("rejects unknown runtime event envelope fields", () => {
    const result = runtimeEventEnvelopeSchema.safeParse({
      schemaVersion: "1.0.0",
      eventId: "event-1",
      sequence: 1,
      type: "run.started",
      emittedAt: "2026-10-05T00:00:00.000Z",
      context: {
        requestId: "request-1",
        threadId: "thread-1",
        runId: "run-1",
        taskId: "task-1",
        attempt: 1,
        principalId: "user-1",
        tenantId: "tenant-1",
        scopeId: "scope-1",
        scopeType: "tenant",
      },
      payload: { status: "running" },
      unexpected: true,
    });
    assert.equal(result.success, false);
  });
});
