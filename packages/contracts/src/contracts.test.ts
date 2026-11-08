import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MODEL_STREAM_OUTPUT_KINDS,
  RUNTIME_EVENT_PAYLOAD_SCHEMAS,
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


describe("model.stream payload", () => {
  const schema = RUNTIME_EVENT_PAYLOAD_SCHEMAS["model.stream"];
  const payload = { delta: "hello", messageId: "message-1", outputKind: "answer_text", textOffset: 0 };

  it("D6-1 preserves legacy delta-only payloads without defaults", () => {
    assert.deepEqual(schema.parse({ delta: "hello" }), { delta: "hello" });
  });
  it("D6-2 preserves all three valid identity fields", () => {
    assert.deepEqual(schema.parse(payload), payload);
  });
  it("D6-3 accepts independently optional identity fields", () => {
    for (const identity of [{ messageId: "message-1" }, { outputKind: "answer_text" }, { textOffset: 0 }]) {
      const partial = { delta: "hello", ...identity };
      assert.deepEqual(schema.parse(partial), partial);
    }
  });
  it("D6-4 rejects unknown fields with unrecognized_keys", () => {
    const result = schema.safeParse({ ...payload, unexpected: true });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some((issue) => issue.code === "unrecognized_keys"));
  });
  const invalidFields: { name: string; fields: Record<string, unknown> }[] = [
    { name: "empty messageId", fields: { messageId: "" } },
    { name: "blank messageId", fields: { messageId: "   " } },
    { name: "oversized messageId", fields: { messageId: "m".repeat(257) } },
    { name: "numeric messageId", fields: { messageId: 1 } },
    { name: "unknown outputKind", fields: { outputKind: "reasoning" } },
    { name: "empty outputKind", fields: { outputKind: "" } },
    { name: "negative textOffset", fields: { textOffset: -1 } },
    { name: "fractional textOffset", fields: { textOffset: 1.5 } },
    { name: "NaN textOffset", fields: { textOffset: Number.NaN } },
    { name: "infinite textOffset", fields: { textOffset: Number.POSITIVE_INFINITY } },
    { name: "unsafe textOffset", fields: { textOffset: Number.MAX_SAFE_INTEGER + 1 } },
    { name: "string textOffset", fields: { textOffset: "0" } },
  ];
  for (const { name, fields } of invalidFields) {
    it("D6-5 rejects " + name, () => {
      assert.equal(schema.safeParse({ ...payload, ...fields }).success, false);
    });
  }
  it("D6-6 preserves the delta length limit with valid identity fields", () => {
    assert.equal(schema.safeParse({ ...payload, delta: "x".repeat(65_536) }).success, true);
    assert.equal(schema.safeParse({ ...payload, delta: "x".repeat(65_537) }).success, false);
  });
  it("D6-7 accepts every outputKind from the single source", () => {
    for (const outputKind of MODEL_STREAM_OUTPUT_KINDS) {
      assert.deepEqual(schema.parse({ ...payload, outputKind }), { ...payload, outputKind });
    }
  });
  it("D6-11 trims messageId and preserves other valid fields", () => {
    assert.deepEqual(schema.parse({ ...payload, messageId: "  message-1  " }), payload);
  });
  it("D6-12 accepts MAX_SAFE_INTEGER textOffset", () => {
    const maximum = { ...payload, textOffset: Number.MAX_SAFE_INTEGER };
    assert.deepEqual(schema.parse(maximum), maximum);
  });
});
