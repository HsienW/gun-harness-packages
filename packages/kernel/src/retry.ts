import type {
  BackoffOptions,
  BackoffStrategy,
  BudgetCheckResult,
  ClassifiedError,
  ErrorClassificationContext,
  ErrorCategory,
  RetryBudget,
  RetryPolicy,
  StepError,
} from "@gun-ai/harness-contracts";

interface Classification { category: ErrorCategory; retryable: boolean }

function classifyByCode(code: string): Classification | undefined {
  switch (code) {
    case "USER_CANCELLED": return { category: "user_cancelled", retryable: false };
    case "PERMISSION_DENIED": return { category: "permission_denied", retryable: false };
    case "BUSINESS_REJECTED": return { category: "business_rejected", retryable: false };
    case "RATE_LIMITED": return { category: "rate_limit", retryable: true };
    case "TIMEOUT":
    case "ETIMEDOUT":
    case "ABORT_ERR": return { category: "timeout", retryable: true };
    case "UPSTREAM_ERROR": return { category: "server_error", retryable: true };
    case "SCHEMA_INVALID": return { category: "schema_invalid", retryable: false };
    default: return undefined;
  }
}

function classifyByStatusCode(statusCode: number | undefined): Classification | undefined {
  if (statusCode === 403) return { category: "permission_denied", retryable: false };
  if (statusCode === 422) return { category: "business_rejected", retryable: false };
  if (statusCode === 429) return { category: "rate_limit", retryable: true };
  if (statusCode !== undefined && statusCode >= 500 && statusCode <= 599) return { category: "server_error", retryable: true };
  if (statusCode === 400) return { category: "schema_invalid", retryable: false };
  return undefined;
}

function parseRetryAfterMs(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const milliseconds = Number(value) * 1_000;
  return Number.isSafeInteger(milliseconds) ? milliseconds : undefined;
}

export function classifyError(error: StepError, context: ErrorClassificationContext = {}): ClassifiedError {
  const classification = classifyByCode(error.code) ?? classifyByStatusCode(context.statusCode) ?? {
    category: "unknown" as const,
    retryable: false,
  };
  const retryAfterMs = classification.category === "rate_limit"
    ? parseRetryAfterMs(context.retryAfterHeader)
    : undefined;
  return {
    ...classification,
    code: error.code,
    message: error.message,
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    originalError: error,
  };
}

const DEFAULT_BASE_MS = 1_000;
const DEFAULT_MAX_MS = 30_000;

export function computeBackoff(strategy: BackoffStrategy, attempt: number, options: BackoffOptions = {}): number {
  const baseMs = options.baseMs ?? DEFAULT_BASE_MS;
  const maxMs = options.maxMs ?? DEFAULT_MAX_MS;
  const normalizedAttempt = Math.max(1, Math.trunc(attempt));
  const exponential = Math.min(baseMs * 2 ** (normalizedAttempt - 1), maxMs);
  const delay = strategy === "fixed"
    ? baseMs
    : strategy === "retry-after-header" && options.retryAfterMs !== undefined
      ? Math.min(options.retryAfterMs, maxMs)
      : exponential;
  if (options.jitter === false) return delay;
  const jittered = delay * (0.75 + (options.random ?? Math.random)() * 0.5);
  return strategy === "retry-after-header" ? Math.min(jittered, maxMs) : jittered;
}

export function createBudget(stepId: string, policy: RetryPolicy, now: () => number = Date.now): RetryBudget {
  return { stepId, maxAttempts: policy.maxAttempts, maxElapsedMs: policy.maxElapsedMs, startedAt: now(), attempts: 0 };
}

export function checkBudget(budget: RetryBudget, signal?: AbortSignal, now: () => number = Date.now): BudgetCheckResult {
  if (signal?.aborted === true) return { exhausted: true, reason: "cancelled", canRetry: false };
  if (budget.attempts >= budget.maxAttempts) return { exhausted: true, reason: "max_attempts", canRetry: false };
  if (now() - budget.startedAt >= budget.maxElapsedMs) return { exhausted: true, reason: "max_elapsed", canRetry: false };
  return { exhausted: false, canRetry: true };
}

export function recordAttempt(budget: RetryBudget): RetryBudget {
  return { ...budget, attempts: budget.attempts + 1 };
}
