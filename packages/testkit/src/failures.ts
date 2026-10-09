export type FailureInjectionKind =
  | "timeout"
  | "cancellation"
  | "malformed_argument"
  | "duplicate_delivery"
  | "authz_denial"
  | "approval_wait";

export type FailureInjectionFixture =
  | { kind: "timeout"; errorCode: "TIMEOUT"; delayMs: number }
  | { kind: "cancellation"; errorCode: "USER_CANCELLED"; reason: string }
  | { kind: "malformed_argument"; errorCode: "SCHEMA_INVALID"; value: unknown }
  | { kind: "duplicate_delivery"; deliveryCount: number }
  | { kind: "authz_denial"; errorCode: "PERMISSION_DENIED" }
  | { kind: "approval_wait"; errorCode: "REQUIRES_CONFIRMATION"; timeoutMs: number };

export function createFailureInjectionFixture(kind: FailureInjectionKind): FailureInjectionFixture {
  switch (kind) {
    case "timeout": return { kind, errorCode: "TIMEOUT", delayMs: 30_000 };
    case "cancellation": return { kind, errorCode: "USER_CANCELLED", reason: "fixture cancellation" };
    case "malformed_argument": return { kind, errorCode: "SCHEMA_INVALID", value: { malformed: true } };
    case "duplicate_delivery": return { kind, deliveryCount: 2 };
    case "authz_denial": return { kind, errorCode: "PERMISSION_DENIED" };
    case "approval_wait": return { kind, errorCode: "REQUIRES_CONFIRMATION", timeoutMs: 60_000 };
  }
}
