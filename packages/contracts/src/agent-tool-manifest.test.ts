import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import {
  MANIFEST_SCHEMA_VERSION,
  agentToolManifestSchema,
  toolManifestSchema,
} from "./agent-tool-manifest.js";
import { structuredToolResultEnvelopeSchema } from "./tool.js";

function toolFixture(): Record<string, unknown> {
  return {
    kind: "tool",
    manifestVersion: MANIFEST_SCHEMA_VERSION,
    toolId: "read_tool",
    toolVersion: "1.0",
    description: "Read a value",
    inputSchema: z.object({ value: z.string() }).strict(),
    outputSchema: z.string(),
    sideEffectClass: "read-only",
    requiredCapabilities: ["tool:read"],
    executionProfile: {
      profileId: "read-profile",
      profileVersion: "1.0",
      egress: { destinations: [], protocols: [] },
    },
    idempotency: { kind: "read_only" },
    approvalPolicyKey: "none",
    timeoutRetryClass: "read-default",
    compensation: "none",
    dataClassification: "tool:public",
  };
}

describe("agent/tool manifest contract", () => {
  it("accepts a complete in-memory Zod declaration", () => {
    const input = toolFixture();
    const parsed = toolManifestSchema.parse(input);
    assert.equal(parsed.toolId, "read_tool");
    assert.equal(agentToolManifestSchema.parse(input).kind, "tool");
  });

  it("rejects missing authorization actions or independent profile", () => {
    assert.equal(toolManifestSchema.safeParse({ ...toolFixture(), requiredCapabilities: [] }).success, false);
    const withoutProfile = toolFixture();
    delete withoutProfile.executionProfile;
    assert.equal(toolManifestSchema.safeParse(withoutProfile).success, false);
  });

  it("rejects custom and contradictory side-effect declarations", () => {
    assert.equal(toolManifestSchema.safeParse({ ...toolFixture(), sideEffectClass: "custom" }).success, false);
    assert.equal(toolManifestSchema.safeParse({
      ...toolFixture(),
      idempotency: { kind: "business_effect_key", descriptorRef: "effect-1" },
    }).success, false);
    assert.equal(toolManifestSchema.safeParse({
      ...toolFixture(),
      sideEffectClass: "irreversible",
      idempotency: { kind: "business_effect_key", descriptorRef: "effect-1" },
      compensation: "reconcile_only",
    }).success, false);
  });

  it("requires canonical Zod schemas and a namespaced classification key", () => {
    assert.equal(toolManifestSchema.safeParse({ ...toolFixture(), inputSchema: { safeParse() { return { success: true }; } } }).success, false);
    assert.equal(toolManifestSchema.safeParse({ ...toolFixture(), dataClassification: "public" }).success, false);
  });

  it("accepts additive manifest provenance while retaining legacy result validity", () => {
    const legacy = {
      schemaVersion: "1.0", kind: "tool_result",
      correlation: { requestId: "request-1", threadId: "thread-1", runId: "run-1", toolCallId: "call-1" },
      tool: { name: "read_tool", version: "1.0", riskTier: "read", readOnly: true },
      outcome: { type: "succeeded", result: "ok" }, emittedAt: "2026-10-12T00:00:00.000Z",
    };
    assert.equal(structuredToolResultEnvelopeSchema.safeParse(legacy).success, true);
    assert.equal(structuredToolResultEnvelopeSchema.safeParse({ ...legacy, manifestVersion: MANIFEST_SCHEMA_VERSION }).success, true);
  });
  it("uses a discriminated union for agents", () => {
    const parsed = agentToolManifestSchema.parse({
      kind: "agent",
      manifestVersion: MANIFEST_SCHEMA_VERSION,
      agentId: "agent-1",
      agentVersion: "1.0",
      description: "A minimal agent",
      tools: [{ toolId: "read_tool", toolVersion: "1.0" }],
    });
    assert.equal(parsed.kind, "agent");
  });
});
