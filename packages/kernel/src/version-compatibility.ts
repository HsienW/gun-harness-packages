export interface RuntimeVersionSet {
  schemaVersion: string;
  eventVersion: string;
  packageVersion: string;
  checkpointVersion?: string;
  sideEffectVersion?: string;
  idempotencyVersion?: string;
}

export type VersionCompatibility =
  | { status: "compatible" }
  | { status: "incompatible"; errorCode: "RUNTIME_VERSION_INCOMPATIBLE" }
  | { status: "unknown"; errorCode: "RUNTIME_VERSION_UNTESTED" };

function parseVersionSet(value: unknown): RuntimeVersionSet {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid RuntimeVersionSet");
  const record = value as Record<string, unknown>;
  const allowed = new Set(["schemaVersion", "eventVersion", "packageVersion", "checkpointVersion", "sideEffectVersion", "idempotencyVersion"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new Error("Invalid RuntimeVersionSet");
  for (const field of ["schemaVersion", "eventVersion", "packageVersion"] as const) {
    if (typeof record[field] !== "string" || record[field].trim().length === 0) throw new Error("Invalid RuntimeVersionSet");
  }
  for (const field of ["checkpointVersion", "sideEffectVersion", "idempotencyVersion"] as const) {
    if (record[field] !== undefined && (typeof record[field] !== "string" || record[field].trim().length === 0)) {
      throw new Error("Invalid RuntimeVersionSet");
    }
  }
  return {
    schemaVersion: record.schemaVersion as string,
    eventVersion: record.eventVersion as string,
    packageVersion: record.packageVersion as string,
    ...(record.checkpointVersion === undefined ? {} : { checkpointVersion: record.checkpointVersion as string }),
    ...(record.sideEffectVersion === undefined ? {} : { sideEffectVersion: record.sideEffectVersion as string }),
    ...(record.idempotencyVersion === undefined ? {} : { idempotencyVersion: record.idempotencyVersion as string }),
  };
}

export function evaluateRuntimeVersionCompatibility(input: {
  observed: unknown;
  supported: readonly RuntimeVersionSet[];
  explicitlyIncompatible?: readonly RuntimeVersionSet[];
}): VersionCompatibility {
  const observed = parseVersionSet(input.observed);
  const key = (versions: RuntimeVersionSet) => JSON.stringify(versions);
  if ((input.explicitlyIncompatible ?? []).some((versions) => key(versions) === key(observed))) {
    return { status: "incompatible", errorCode: "RUNTIME_VERSION_INCOMPATIBLE" };
  }
  if (input.supported.some((versions) => key(versions) === key(observed))) return { status: "compatible" };
  return { status: "unknown", errorCode: "RUNTIME_VERSION_UNTESTED" };
}

export class RuntimeVersionCompatibilityError extends Error {
  readonly name = "RuntimeVersionCompatibilityError";
  readonly code: "RUNTIME_VERSION_INCOMPATIBLE" | "RUNTIME_VERSION_UNTESTED";
  readonly retryable = false;
  readonly correlation: Readonly<Record<string, string>>;

  constructor(code: "RUNTIME_VERSION_INCOMPATIBLE" | "RUNTIME_VERSION_UNTESTED", correlation: Readonly<Record<string, string>> = {}) {
    super(code);
    this.code = code;
    this.correlation = correlation;
  }
}

export function assertResumeVersionCompatible(
  result: VersionCompatibility,
  options: { correlation?: Readonly<Record<string, string>> } = {}
): void {
  if (result.status !== "compatible") throw new RuntimeVersionCompatibilityError(result.errorCode, options.correlation);
}
