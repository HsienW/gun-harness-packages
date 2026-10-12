import { MANIFEST_SCHEMA_VERSION } from "@gun-ai/harness-contracts";
import type { RegistrationInput } from "@gun-ai/harness-sdk";
import { z } from "zod";

export type SdkRegistrationFailureKind = "duplicate_tool_id" | "invalid_schema";

/** Identical inputs can be replayed by SDK and host registration tests. */
export function createSdkRegistrationFailureFixture(kind: SdkRegistrationFailureKind): {
  readonly input: RegistrationInput;
  readonly expectedCode: "DUPLICATE_TOOL_ID" | "INVALID_SCHEMA";
} {
  const manifest = {
    kind: "tool",
    manifestVersion: MANIFEST_SCHEMA_VERSION,
    toolId: "fixture_read_tool",
    toolVersion: "1.0",
    description: "Read fixture value",
    inputSchema: z.object({ value: z.string() }).strict(),
    outputSchema: z.string(),
    sideEffectClass: "read-only",
    requiredCapabilities: ["tool:read"],
    executionProfile: {
      profileId: "fixture-read-profile", profileVersion: "1.0",
      egress: { destinations: [], protocols: [] },
    },
    idempotency: { kind: "read_only" },
    approvalPolicyKey: "none",
    timeoutRetryClass: "fixture-read-default",
    compensation: "none",
    dataClassification: "tool:public",
  };
  if (kind === "duplicate_tool_id") {
    return {
      input: { manifest, existingTools: [{ toolId: manifest.toolId, toolVersion: manifest.toolVersion }] },
      expectedCode: "DUPLICATE_TOOL_ID",
    };
  }
  return {
    input: { manifest: { ...manifest, inputSchema: { safeParse: () => ({ success: true }) } } },
    expectedCode: "INVALID_SCHEMA",
  };
}
