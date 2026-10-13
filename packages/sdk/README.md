# @gun-ai/harness-sdk

Declarative agent and tool manifests for Gun Harness. The SDK validates and projects declarations. The trusted host owns authorization, execution profiles, dispatch, sandbox enforcement, retries, side effects, and audit.

## Minimal declaration and registration

```ts
import { z } from "zod";
import { MANIFEST_SCHEMA_VERSION } from "@gun-ai/harness-contracts";
import { defineAgent, defineTool, registerTool } from "@gun-ai/harness-sdk";

const weather = defineTool({
  kind: "tool",
  manifestVersion: MANIFEST_SCHEMA_VERSION,
  toolId: "current_weather",
  toolVersion: "1.0",
  description: "Read current weather",
  inputSchema: z.object({ location: z.string() }).strict(),
  outputSchema: z.string(),
  sideEffectClass: "read-only",
  requiredCapabilities: ["tool:read"],
  executionProfile: {
    profileId: "weather-profile", profileVersion: "1.0",
    egress: { destinations: ["api.open-meteo.com"], protocols: ["https"] },
  },
  idempotency: { kind: "read_only" },
  approvalPolicyKey: "none",
  timeoutRetryClass: "weather-read-v1",
  compensation: "none",
  dataClassification: "tool:public",
});
const agent = defineAgent({
  kind: "agent", manifestVersion: MANIFEST_SCHEMA_VERSION,
  agentId: "weather-agent", agentVersion: "1.0", description: "Weather agent",
  tools: [{ toolId: weather.toolId, toolVersion: weather.toolVersion }],
});
const result = await registerTool({ manifest: weather });
if (!result.ok) throw new Error(result.error.code);
// The trusted host now resolves the declared action, profile, approval policy,
// and timeout/retry class against its own registries before publishing a tool.
void agent;
```

The keys and destinations above are examples of declarations. They grant no runtime permission. The host must reject a missing or conflicting policy, profile, egress requirement, or timeout/retry class. `RegistrationPlan.manifest` contains Zod schemas and stays in memory; never serialize it into a checkpoint or audit record.

## Provider descriptions and context

```ts
import { createContextView, projectProviderToolDescription } from "@gun-ai/harness-sdk";

const description = projectProviderToolDescription(weather, {
  providerId: "provider-adapter",
  projectInputSchema: (canonical) => ({ type: "object", description: canonical.description }),
});
const view = createContextView(["tool:read"] as const, ["tool:read"], ["env:WEATHER_KEY"]);
// view.capabilities contains only { "tool:read": true }; secretRefs has opaque references.
void description;
void view;
```

A provider-specific schema is only a presentation. Dispatch validates input and output against the canonical Zod schemas independently. The host supplies the authorized action set to `createContextView`; this view does not authorize actions or expose credentials.

## Registration hooks

Hooks run synchronously in this order: `onBeforeRegister`, `onValidate`, `onProject`. Each sees a frozen view of tool identity, description and already appended metadata. A hook may return only new namespaced string metadata keys, such as `{ "note:owner": "weather" }`. Duplicate keys, invalid values, thrown errors and async returns produce `HOOK_FAILED`. Hooks cannot change principal, tenant, authorization, approval, billing, schemas or execution identity. Module preparation is separately bounded by `initializationTimeoutMs` and an `AbortSignal`; load failure and timeout are typed registration failures. The host publishes no registry entry until the entire candidate set succeeds.

## Existing tool migration: `current_weather`

1. Build the legacy descriptor, X13 risk policy, X25 execution profile and timeout/retry settings in the trusted `loadAgentToolRuntime` composition root.
2. Use `stageCurrentWeatherSdkDescriptor` to derive and validate the manifest from those existing contracts. Reject missing action/profile, schema or egress drift, and unknown timeout/retry settings before serving traffic.
3. Replace the single `current_weather` descriptor in the staged candidate list with the SDK descriptor. Register each stable ID once, then publish one descriptor registry and the existing X14 dispatcher. The SDK descriptor adds only `manifestVersion` provenance.
4. Compare SDK and legacy paths using the same dispatcher, authorization engine, execution profile enforcer and Weather regression cases. To roll back, select the legacy registration in the composition root; never register both under the same ID.

## Intentionally rejected examples

```ts
// Missing executionProfile: the manifest is incomplete and registration fails.
const unsafe = { ...weather, executionProfile: undefined };
await registerTool({ manifest: unsafe }); // MISSING_PROFILE

// Hook tries to replace authority rather than append metadata.
await registerTool({
  manifest: weather,
  hooks: { onValidate: () => ({ principalId: "admin" }) },
}); // HOOK_FAILED: metadata keys must be namespaced
```

An SDK-created executor or direct `protectedTool.invoke(...)` is also rejected by the host architecture gate. The SDK never executes protected tools or supplies an alternate authorization path.
