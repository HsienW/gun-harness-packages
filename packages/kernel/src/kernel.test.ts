import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  RuntimeVersionCompatibilityError,
  assertResumeVersionCompatible,
  checkBudget,
  classifyError,
  computeBackoff,
  createBudget,
  createReplayKey,
  createRequestDedupKey,
  createToolExecutionAttemptIdentity,
  evaluateRuntimeVersionCompatibility,
  hashBusinessEffectKey,
  isScopeCompatible,
  parseKey,
  parseRuntimeEventEnvelope,
  projectTrustedScope,
  serializeKey,
  stableEventId,
} from "./index.js";

const hash = (values: readonly string[]) =>
  createHash("sha256").update(JSON.stringify(values)).digest("hex");

describe("kernel deterministic primitives", () => {
  it("classifies retryable errors without changing error identity", () => {
    const originalError = { code: "RATE_LIMITED", message: "retry" };
    assert.deepEqual(classifyError(originalError, { retryAfterHeader: "2" }), {
      category: "rate_limit",
      retryable: true,
      retryAfterMs: 2_000,
      code: "RATE_LIMITED",
      message: "retry",
      originalError,
    });
  });

  it("uses injected randomness and time", () => {
    assert.equal(computeBackoff("fixed", 1, { baseMs: 100, random: () => 0 }), 75);
    const budget = createBudget("step-1", { maxAttempts: 2, maxElapsedMs: 10, retryableCategories: [], backoffStrategy: "fixed", jitter: false }, () => 5);
    assert.deepEqual(checkBudget(budget, undefined, () => 14), { exhausted: false, canRetry: true });
    assert.deepEqual(checkBudget(budget, undefined, () => 15), { exhausted: true, reason: "max_elapsed", canRetry: false });
    assert.equal(stableEventId(undefined, () => "event-1"), "event-1");
  });

  it("derives side-effect identities only through injected ports", () => {
    const replayKey = createReplayKey({
      runId: "run-1", stepId: "step-1", toolCallId: "call-1", callIndex: 0,
      toolName: "weather", toolVersion: "1",
    }, { hash });
    assert.equal(replayKey.length, 64);
    assert.equal(hashBusinessEffectKey("effect", { hash }).length, 64);
    assert.equal(createRequestDedupKey({
      tenantId: "tenant-1", principalId: "principal-1",
      routeNamespace: "chat", clientKey: "client-1",
    }, { hash }).length, 64);
    assert.deepEqual(createToolExecutionAttemptIdentity({
      toolExecutionId: "tool-execution-1", executionAttempt: 1,
    }, { randomUUID: () => "attempt-1" }), {
      toolExecutionAttemptId: "attempt-1",
      toolExecutionId: "tool-execution-1",
      executionAttempt: 1,
    });
  });

  it("preserves serialization and scope semantics", () => {
    const serialized = serializeKey({ namespace: "tool", resourceKey: "tenant:item", version: "1" });
    assert.equal(serialized, "tool:tenant:item:v1");
    assert.deepEqual(parseKey(serialized), { namespace: "tool", resourceKey: "tenant:item", version: "1" });
    const projected = projectTrustedScope({ scopeId: "scope-1", tenantId: "tenant-1", principalId: "principal-1" }, "tenant");
    assert.equal(isScopeCompatible(projected.scope, projected, {
      scopeId: "scope-1", tenantId: "tenant-1", principalId: "principal-1",
    }), true);
  });

  it("validates event envelopes with the v4 schema", () => {
    const envelope = parseRuntimeEventEnvelope({
      schemaVersion: "1.0.0",
      eventId: "event-1",
      sequence: 1,
      type: "run.started",
      emittedAt: "2026-10-04T00:00:00.000Z",
      context: {
        requestId: "request-1", threadId: "thread-1", runId: "run-1", taskId: "task-1",
        attempt: 1, principalId: "principal-1", tenantId: "tenant-1", scopeId: "scope-1", scopeType: "tenant",
      },
      payload: { status: "running" },
    });
    assert.equal(envelope.schemaVersion, "1.0.0");
  });
});

describe("runtime version compatibility", () => {
  const supported = [{
    schemaVersion: "1.0.0", eventVersion: "1.0.0", packageVersion: "0.1.0",
    checkpointVersion: "1.0", sideEffectVersion: "1.0", idempotencyVersion: "1.0",
  }] as const;

  it("accepts a known complete serialized version set", () => {
    assert.deepEqual(evaluateRuntimeVersionCompatibility({ observed: supported[0], supported }), { status: "compatible" });
  });

  it("throws a typed unknown-version failure with safe correlation", () => {
    const result = evaluateRuntimeVersionCompatibility({
      observed: { ...supported[0], eventVersion: "2.0.0" }, supported,
    });
    assert.throws(
      () => assertResumeVersionCompatible(result, { correlation: { runId: "run-1" } }),
      (error: unknown) => {
        assert.ok(error instanceof RuntimeVersionCompatibilityError);
        assert.equal(error.code, "RUNTIME_VERSION_UNTESTED");
        assert.equal(error.retryable, false);
        assert.deepEqual(error.correlation, { runId: "run-1" });
        assert.equal(JSON.stringify(error).includes("secret"), false);
        return true;
      }
    );
  });
});
