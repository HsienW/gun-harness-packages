import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerTool } from "@gun-ai/harness-sdk";

import {
  createDeterministicClock,
  createDeterministicIdFactory,
  createExecutionContextFixture,
  createFailureInjectionFixture,
  createRuntimeEventEnvelopeFixture,
  createSdkRegistrationFailureFixture,
  createTaskFixture,
} from "./index.js";

describe("testkit deterministic fixtures", () => {
  it("provides controllable time and IDs", () => {
    const clock = createDeterministicClock("2026-10-04T00:00:00.000Z");
    assert.equal(clock.nowIso(), "2026-10-04T00:00:00.000Z");
    clock.advance(250);
    assert.equal(clock.now(), Date.parse("2026-10-04T00:00:00.250Z"));
    const nextId = createDeterministicIdFactory("event");
    assert.equal(nextId(), "event-1");
    assert.equal(nextId(), "event-2");
  });

  it("builds valid v4 execution, task, and event fixtures", () => {
    const context = createExecutionContextFixture({ runId: "run-custom" });
    assert.equal(context.runId, "run-custom");
    assert.equal(context.principal.principalType, "user");
    const task = createTaskFixture({ taskId: context.taskId });
    assert.equal(task.taskId, context.taskId);
    const envelope = createRuntimeEventEnvelopeFixture({ context, payload: { status: "running" } });
    assert.equal(envelope.schemaVersion, "1.0.0");
    assert.equal(envelope.context.runId, "run-custom");
  });

  it("models SDK registration failures with stable IDs", async () => {
    for (const kind of ["duplicate_tool_id", "invalid_schema"] as const) {
      const fixture = createSdkRegistrationFailureFixture(kind);
      const registryBefore = [...(fixture.input.existingTools ?? [])];
      const result = await registerTool(fixture.input);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.error.code, fixture.expectedCode);
        assert.equal(result.error.toolId, "fixture_read_tool");
      }
      assert.deepEqual(fixture.input.existingTools ?? [], registryBefore);
    }
  });

  it("models every required failure injection kind", () => {
    const kinds = ["timeout", "cancellation", "malformed_argument", "duplicate_delivery", "authz_denial", "approval_wait", "ambiguous_commit"] as const;
    assert.deepEqual(kinds.map((kind) => createFailureInjectionFixture(kind).kind), kinds);
  });
});
