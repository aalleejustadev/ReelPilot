export type AppErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INSUFFICIENT_CREDITS"
  | "COMPLIANCE_BLOCKED"
  | "PROVIDER_FAILED"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "INTERNAL"

/**
 * An expected failure with a message that is safe to show the user.
 * Server actions return these inside a Result instead of throwing.
 */
export class AppError extends Error {
  readonly code: AppErrorCode
  /** Per-field messages, set for VALIDATION errors. */
  readonly fieldErrors?: Record<string, string[]>

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { cause?: unknown; fieldErrors?: Record<string, string[]> }
  ) {
    super(message, { cause: options?.cause })
    this.name = "AppError"
    this.code = code
    this.fieldErrors = options?.fieldErrors
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
