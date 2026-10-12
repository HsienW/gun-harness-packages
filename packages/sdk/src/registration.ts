import {
  MANIFEST_SCHEMA_VERSION,
  agentToolManifestSchema,
  toolManifestSchema,
  type AgentManifest,
  type AgentToolManifest,
  type ToolManifest,
} from "@gun-ai/harness-contracts";

export type RegistrationFailureCode =
  | "INVALID_MANIFEST"
  | "INVALID_SCHEMA"
  | "MISSING_ACTION"
  | "MISSING_PROFILE"
  | "UNSUPPORTED_SIDE_EFFECT_CLASS"
  | "INCOMPATIBLE_MANIFEST_VERSION"
  | "DUPLICATE_TOOL_ID"
  | "INCOMPATIBLE_TOOL_VERSION"
  | "HOOK_FAILED"
  | "MODULE_LOAD_FAILED"
  | "INITIALIZATION_TIMEOUT";

export interface RegistrationFailure {
  readonly code: RegistrationFailureCode;
  readonly toolId?: string;
  readonly field?: string;
}

export type RegistrationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RegistrationFailure };

export interface RegistrationPlan {
  /** In-memory declaration. Never serialize this object to checkpoints or audit evidence. */
  readonly manifest: ToolManifest;
  readonly metadata: Readonly<Record<string, string>>;
  readonly loadedModule?: unknown;
}

export interface RegistrationHookView {
  readonly toolId: string;
  readonly toolVersion: string;
  readonly manifestVersion: string;
  readonly description: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export type RegistrationMetadataHook = (
  view: Readonly<RegistrationHookView>
) => Readonly<Record<string, string>> | void;

export interface RegistrationHooks {
  readonly onBeforeRegister?: RegistrationMetadataHook;
  readonly onValidate?: RegistrationMetadataHook;
  readonly onProject?: RegistrationMetadataHook;
}

export interface RegistrationInput {
  readonly manifest: unknown;
  readonly existingTools?: readonly { readonly toolId: string; readonly toolVersion: string }[];
  readonly hooks?: RegistrationHooks;
  /** Optional module preparation. This does not invoke the protected tool. */
  readonly load?: (signal: AbortSignal) => Promise<unknown>;
  readonly initializationTimeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failure(
  code: RegistrationFailureCode,
  toolId?: string,
  field?: string
): RegistrationResult<never> {
  return { ok: false, error: { code, ...(toolId ? { toolId } : {}), ...(field ? { field } : {}) } };
}

export function defineTool<T extends ToolManifest>(manifest: T): T {
  return manifest;
}

export function defineAgent<T extends AgentManifest>(manifest: T): T {
  return manifest;
}

export function validateManifest(value: unknown): RegistrationResult<AgentToolManifest> {
  if (!isRecord(value)) return failure("INVALID_MANIFEST");
  const toolId = typeof value.toolId === "string" ? value.toolId : undefined;
  if (value.manifestVersion !== MANIFEST_SCHEMA_VERSION) {
    return failure("INCOMPATIBLE_MANIFEST_VERSION", toolId, "manifestVersion");
  }
  if (value.kind === "tool") {
    if (!Array.isArray(value.requiredCapabilities) || value.requiredCapabilities.length === 0) {
      return failure("MISSING_ACTION", toolId, "requiredCapabilities");
    }
    if (!isRecord(value.executionProfile)) {
      return failure("MISSING_PROFILE", toolId, "executionProfile");
    }
    if (value.sideEffectClass === "custom") {
      return failure("UNSUPPORTED_SIDE_EFFECT_CLASS", toolId, "sideEffectClass");
    }
    if (!isRecord(value.inputSchema) || !isRecord(value.outputSchema)) {
      return failure("INVALID_SCHEMA", toolId, "inputSchema");
    }
  }
  const parsed = agentToolManifestSchema.safeParse(value);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".");
    const code = field === "inputSchema" || field === "outputSchema" ? "INVALID_SCHEMA" : "INVALID_MANIFEST";
    return failure(code, toolId, field);
  }
  return { ok: true, value: parsed.data };
}

function appendMetadata(
  metadata: Readonly<Record<string, string>>,
  additions: Readonly<Record<string, string>> | void
): RegistrationResult<Readonly<Record<string, string>>> {
  if (additions === undefined) return { ok: true, value: metadata };
  if (!isRecord(additions) || "then" in additions) return failure("HOOK_FAILED");
  const merged: Record<string, string> = { ...metadata };
  for (const [key, value] of Object.entries(additions)) {
    if (!/^[a-z][a-z0-9._-]*:[a-z][a-z0-9._-]*$/.test(key) || typeof value !== "string" || key in merged) {
      return failure("HOOK_FAILED");
    }
    merged[key] = value;
  }
  return { ok: true, value: Object.freeze(merged) };
}

function runHooks(
  manifest: ToolManifest,
  hooks: RegistrationHooks | undefined
): RegistrationResult<Readonly<Record<string, string>>> {
  let metadata: Readonly<Record<string, string>> = Object.freeze({});
  for (const hook of [hooks?.onBeforeRegister, hooks?.onValidate, hooks?.onProject]) {
    if (hook === undefined) continue;
    try {
      const view: RegistrationHookView = Object.freeze({
        toolId: manifest.toolId,
        toolVersion: manifest.toolVersion,
        manifestVersion: manifest.manifestVersion,
        description: manifest.description,
        metadata,
      });
      const result = appendMetadata(metadata, hook(view));
      if (!result.ok) return failure("HOOK_FAILED", manifest.toolId);
      metadata = result.value;
    } catch {
      return failure("HOOK_FAILED", manifest.toolId);
    }
  }
  return { ok: true, value: metadata };
}

async function loadModule(
  input: RegistrationInput,
  toolId: string
): Promise<RegistrationResult<unknown>> {
  if (input.load === undefined) return { ok: true, value: undefined };
  const timeoutMs = input.initializationTimeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs === undefined || timeoutMs <= 0) {
    return failure("INITIALIZATION_TIMEOUT", toolId, "initializationTimeoutMs");
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const loaded = await Promise.race([
      input.load(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("initialization timeout"));
        }, timeoutMs);
      }),
    ]);
    if (loaded === undefined || loaded === null) return failure("MODULE_LOAD_FAILED", toolId);
    return { ok: true, value: loaded };
  } catch {
    return failure(controller.signal.aborted ? "INITIALIZATION_TIMEOUT" : "MODULE_LOAD_FAILED", toolId);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function registerTool(input: RegistrationInput): Promise<RegistrationResult<RegistrationPlan>> {
  const validated = validateManifest(input.manifest);
  if (!validated.ok) return validated;
  if (validated.value.kind !== "tool") return failure("INVALID_MANIFEST");
  const manifest = toolManifestSchema.parse(validated.value);
  const existing = input.existingTools?.find((entry) => entry.toolId === manifest.toolId);
  if (existing !== undefined) {
    return failure(
      existing.toolVersion === manifest.toolVersion ? "DUPLICATE_TOOL_ID" : "INCOMPATIBLE_TOOL_VERSION",
      manifest.toolId
    );
  }
  const hooked = runHooks(manifest, input.hooks);
  if (!hooked.ok) return hooked;
  const loaded = await loadModule(input, manifest.toolId);
  if (!loaded.ok) return loaded;
  return {
    ok: true,
    value: {
      manifest,
      metadata: hooked.value,
      ...(input.load ? { loadedModule: loaded.value } : {}),
    },
  };
}

export async function registerTools(
  inputs: readonly RegistrationInput[],
  existingTools: readonly { readonly toolId: string; readonly toolVersion: string }[] = []
): Promise<RegistrationResult<readonly RegistrationPlan[]>> {
  const plans: RegistrationPlan[] = [];
  const seen = [...existingTools];
  for (const input of inputs) {
    const result = await registerTool({ ...input, existingTools: [...seen, ...(input.existingTools ?? [])] });
    if (!result.ok) return result;
    plans.push(result.value);
    seen.push({ toolId: result.value.manifest.toolId, toolVersion: result.value.manifest.toolVersion });
  }
  return { ok: true, value: Object.freeze(plans) };
}
