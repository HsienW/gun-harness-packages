import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { toolManifestSchema } from "@gun-ai/harness-contracts";

import {
  MANIFEST_SCHEMA_VERSION,
  createContextView,
  defineAgent,
  defineTool,
  projectProviderToolDescription,
  registerTool,
  registerTools,
  validateManifest,
} from "./index.js";

function toolFixture(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

describe("SDK declaration and registration", () => {
  it("defines a minimal agent/tool and returns only a registration plan", async () => {
    const tool = defineTool(toolManifestSchema.parse(toolFixture()));
    const agent = defineAgent({
      kind: "agent",
      manifestVersion: MANIFEST_SCHEMA_VERSION,
      agentId: "agent-1",
      agentVersion: "1.0",
      description: "Test agent",
      tools: [{ toolId: tool.toolId, toolVersion: tool.toolVersion }],
    });
    assert.equal(validateManifest(agent).ok, true);
    const result = await registerTool({ manifest: tool });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.manifest.toolId, "read_tool");
    assert.equal("executor" in result.value, false);
    assert.equal("registry" in result.value, false);
  });

  it("fails closed for missing action/profile and unsupported class", async () => {
    for (const [overrides, code] of [
      [{ requiredCapabilities: [] }, "MISSING_ACTION"],
      [{ executionProfile: undefined }, "MISSING_PROFILE"],
      [{ sideEffectClass: "custom" }, "UNSUPPORTED_SIDE_EFFECT_CLASS"],
      [{ manifestVersion: "9.0.0" }, "INCOMPATIBLE_MANIFEST_VERSION"],
      [{ inputSchema: { safeParse() { return { success: true }; } } }, "INVALID_SCHEMA"],
    ] as const) {
      const result = await registerTool({ manifest: toolFixture(overrides) });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, code);
    }
  });

  it("detects duplicate and incompatible stable IDs without publishing anything", async () => {
    const duplicate = await registerTool({
      manifest: toolFixture(),
      existingTools: [{ toolId: "read_tool", toolVersion: "1.0" }],
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.error.code, "DUPLICATE_TOOL_ID");
    const incompatible = await registerTool({
      manifest: toolFixture(),
      existingTools: [{ toolId: "read_tool", toolVersion: "2.0" }],
    });
    assert.equal(incompatible.ok, false);
    if (!incompatible.ok) assert.equal(incompatible.error.code, "INCOMPATIBLE_TOOL_VERSION");
    const batch = await registerTools([
      { manifest: toolFixture() },
      { manifest: toolFixture() },
    ]);
    assert.equal(batch.ok, false);
    if (!batch.ok) assert.equal(batch.error.code, "DUPLICATE_TOOL_ID");
  });

  it("keeps equivalent local duplicate and invalid-schema failure fixtures without a testkit dependency", async () => {
    const manifest = toolFixture({
      toolId: "fixture_read_tool",
      description: "Read fixture value",
      executionProfile: {
        profileId: "fixture-read-profile",
        profileVersion: "1.0",
        egress: { destinations: [], protocols: [] },
      },
      timeoutRetryClass: "fixture-read-default",
    });
    for (const [input, expectedCode, expectedRegistry] of [
      [
        { manifest, existingTools: [{ toolId: "fixture_read_tool", toolVersion: "1.0" }] },
        "DUPLICATE_TOOL_ID",
        [{ toolId: "fixture_read_tool", toolVersion: "1.0" }],
      ],
      [
        { manifest: { ...manifest, inputSchema: { safeParse: () => ({ success: true }) } } },
        "INVALID_SCHEMA",
        [],
      ],
    ] as const) {
      const registryBefore = [...("existingTools" in input ? input.existingTools : [])];
      const result = await registerTool(input);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.error.code, expectedCode);
        assert.equal(result.error.toolId, "fixture_read_tool");
      }
      assert.deepEqual(registryBefore, expectedRegistry);
      assert.deepEqual("existingTools" in input ? input.existingTools : [], registryBefore);
    }
  });

  it("runs bounded synchronous hooks in order and only appends metadata", async () => {
    const order: string[] = [];
    const result = await registerTool({
      manifest: toolFixture(),
      hooks: {
        onBeforeRegister(view) {
          order.push("before");
          assert.deepEqual(Object.keys(view).sort(), ["description", "manifestVersion", "metadata", "toolId", "toolVersion"]);
          return { "note:before": "one" };
        },
        onValidate(view) {
          order.push("validate");
          assert.equal(view.metadata["note:before"], "one");
          return { "note:validated": "two" };
        },
        onProject() {
          order.push("project");
          return { "note:projected": "three" };
        },
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(order, ["before", "validate", "project"]);
    if (result.ok) assert.deepEqual(result.value.metadata, {
      "note:before": "one",
      "note:validated": "two",
      "note:projected": "three",
    });
  });

  it("propagates hook and module failures as typed registration failures", async () => {
    const hookFailure = await registerTool({
      manifest: toolFixture(),
      hooks: { onValidate() { throw new Error("secret detail"); } },
    });
    assert.equal(hookFailure.ok, false);
    if (!hookFailure.ok) assert.equal(hookFailure.error.code, "HOOK_FAILED");
    const moduleFailure = await registerTool({
      manifest: toolFixture(),
      load: async () => { throw new Error("dynamic import failed"); },
      initializationTimeoutMs: 20,
    });
    assert.equal(moduleFailure.ok, false);
    if (!moduleFailure.ok) assert.equal(moduleFailure.error.code, "MODULE_LOAD_FAILED");
    const timeout = await registerTool({
      manifest: toolFixture(),
      load: async (signal) => new Promise((resolve) => {
        signal.addEventListener("abort", () => resolve("late"), { once: true });
      }),
      initializationTimeoutMs: 1,
    });
    assert.equal(timeout.ok, false);
    if (!timeout.ok) assert.equal(timeout.error.code, "INITIALIZATION_TIMEOUT");
  });

  it("projects provider descriptions without changing canonical Zod validation", () => {
    const manifest = toolFixture();
    const projected = projectProviderToolDescription(manifest, {
      providerId: "example-provider",
      projectDescription: (value) => value.slice(0, 4),
      projectInputSchema: () => ({ type: "object" }),
    });
    assert.equal(projected.name, "read_tool");
    assert.equal(projected.description, "Read");
    assert.deepEqual(projected.parameters, { type: "object" });
    assert.equal(manifest.inputSchema.safeParse({ value: 1 }).success, false);
  });

  it("exposes only declared capability flags and secret references", () => {
    const view = createContextView(["tool:read"] as const, ["tool:read", "tool:write"], ["env:SAFE_REF"]);
    assert.deepEqual(Object.keys(view.capabilities), ["tool:read"]);
    assert.equal(view.capabilities["tool:read"], true);
    assert.equal("tool:write" in view.capabilities, false);
    assert.deepEqual(view.secretRefs, ["env:SAFE_REF"]);
  });
});
