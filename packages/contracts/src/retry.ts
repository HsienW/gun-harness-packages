import type { StepError } from "./lifecycle.js";

export type ErrorCategory =
  | "timeout" | "rate_limit" | "server_error" | "schema_invalid"
  | "permission_denied" | "business_rejected" | "user_cancelled" | "unknown";

export interface ClassifiedError {
  category: ErrorCategory;
  code: string;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  originalError: StepError;
}

export interface ErrorClassificationContext { statusCode?: number; retryAfterHeader?: string }
export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  retryAfterMs?: number;
  jitter?: boolean;
  random?: () => number;
}
export type BackoffStrategy = "exponential" | "fixed" | "retry-after-header";

export interface RetryPolicy {
  maxAttempts: number;
  maxElapsedMs: number;
  retryableCategories: ErrorCategory[];
  backoffStrategy: BackoffStrategy;
  jitter: boolean;
}

export type BudgetExhaustionReason = "max_attempts" | "max_elapsed" | "cancelled";
export interface RetryBudget { stepId: string; maxAttempts: number; maxElapsedMs: number; startedAt: number; attempts: number }
export interface BudgetCheckResult { exhausted: boolean; reason?: BudgetExhaustionReason; canRetry: boolean }
