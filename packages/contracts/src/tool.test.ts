import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";

import { structuredToolResultEnvelopeSchema } from "./index.js";
import type { StructuredToolResultEnvelope, ToolExecutionTerminationCause } from "./index.js";

const original = { businessEffectId: "effect-1" };
const reasons = ["committed_result_reused", "in_flight_duplicate", "original_outcome_unknown"] as const;
const envelope = (outcome: unknown) => ({
  schemaVersion: "1.0", kind: "tool_result",
  correlation: { requestId: "request-1", threadId: "thread-1", runId: "run-1", toolCallId: "call-1" },
  tool: { name: "tool", version: "1", riskTier: "write", readOnly: false },
  outcome, terminationCause: "deduplicated", emittedAt: "2026-10-24T00:00:00.000Z",
});
const accepts = (outcome: unknown) => structuredToolResultEnvelopeSchema.safeParse(envelope(outcome)).success;

describe("deduplicated governed outcomes", () => {
  for (const reason of reasons) {
    it(`validates ${reason} and preserves its original reference`, () => {
      for (const reference of [original, { ...original, toolExecutionId: "execution-1" }]) {
        const outcome = { type: "deduplicated", reason, original: reference,
          ...(reason === "committed_result_reused" ? { result: { value: 1 } } : {}) };
        assert.deepEqual(structuredToolResultEnvelopeSchema.parse(envelope(outcome)).outcome, outcome);
      }
    });
    it(`enforces result presence for ${reason}`, () => {
      const outcome = { type: "deduplicated", reason, original };
      assert.equal(accepts(outcome), reason !== "committed_result_reused");
      for (const result of [undefined, null, false, 0, "", [], { value: 1 }]) {
        assert.equal(accepts({ ...outcome, result }), reason === "committed_result_reused");
      }
    });
    it(`rejects extra fields and malformed references for ${reason}`, () => {
      const outcome = { type: "deduplicated", reason, original,
        ...(reason === "committed_result_reused" ? { result: null } : {}) };
      assert.equal(accepts({ ...outcome, extra: true }), false);
      for (const reference of [undefined, null, {}, { businessEffectId: 1 },
        { ...original, toolExecutionId: 1 }, { ...original, extra: true }]) {
        assert.equal(accepts({ ...outcome, original: reference }), false);
      }
    });
  }

  it("rejects missing or unknown reasons", () => {
    for (const reason of [undefined, null, "unknown"]) {
      assert.equal(accepts({ type: "deduplicated", reason, original }), false);
    }
  });

  it("preserves all existing outcome variants", () => {
    for (const outcome of [
      { type: "succeeded", result: 1 },
      { type: "rejected_before_dispatch", errorCode: "ERROR" },
      { type: "denied_by_authorization", errorCode: "ERROR", decisionId: "decision-1" },
      { type: "confirmation_required", decisionId: "decision-1", descriptor: {} },
      { type: "failed_not_committed", errorCode: "ERROR" },
      { type: "ambiguous_after_dispatch", errorCode: "ERROR" },
      { type: "cancelled", dispatchState: "before" },
    ]) {
      assert.equal(accepts(outcome), true);
      assert.equal(accepts({ ...outcome, extra: true }), false);
    }
  });

  it("keeps the two TypeScript deduplicated definitions identical", async () => {
    const variants = async (file: string, alias: string) => {
      const source = ts.createSourceFile(file, await readFile(new URL(`../src/${file}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
      const declaration = source.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === alias);
      assert.ok(declaration && ts.isUnionTypeNode(declaration.type));
      return declaration.type.types.filter(node => node.getText(source).includes('type: "deduplicated"')).map(node => node.getText(source));
    };
    const tool = await variants("tool.ts", "GovernedOutcome");
    assert.equal(tool.length, 2);
    assert.deepEqual(await variants("side-effect.ts", "GovernedToolOutcome"), tool);
  });

  it("records the reviewed deduplication contract in the API snapshot", async () => {
    const snapshot = JSON.parse(await readFile(new URL("../api-surface.json", import.meta.url), "utf8"));
    assert.deepEqual(snapshot.governedOutcomes.deduplicated, {
      since: "0.1.0-alpha.3", reasons: [...reasons],
      original: { businessEffectId: "string", toolExecutionId: "string?" },
      resultRequiredFor: ["committed_result_reused"], strict: true, terminationCause: "deduplicated",
    });
  });

  it("exposes typed outcomes and the termination cause", () => {
    type Outcome = StructuredToolResultEnvelope<number>["outcome"];
    const committed: Outcome = { type: "deduplicated", reason: "committed_result_reused", original, result: 1 };
    const inFlight: Outcome = { type: "deduplicated", reason: "in_flight_duplicate", original };
    const unknown: Outcome = { type: "deduplicated", reason: "original_outcome_unknown", original };
    const cause: ToolExecutionTerminationCause = "deduplicated";
    // @ts-expect-error A reused result must be present.
    const missing: Outcome = { type: "deduplicated", reason: "committed_result_reused", original };
    // @ts-expect-error An in-flight duplicate cannot carry a result.
    const unexpected: Outcome = { type: "deduplicated", reason: "in_flight_duplicate", original, result: 1 };
    // @ts-expect-error An unknown original outcome cannot carry a result.
    const unknownResult: Outcome = { type: "deduplicated", reason: "original_outcome_unknown", original, result: 1 };
    // @ts-expect-error Reused results preserve the consumer's result type.
    const wrongResult: Outcome = { type: "deduplicated", reason: "committed_result_reused", original, result: "wrong" };
    assert.equal(cause, committed.type);
    assert.equal(accepts(inFlight), true);
    assert.equal(accepts(unknown), true);
    void [missing, unexpected, unknownResult, wrongResult];
  });
});
