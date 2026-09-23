import { isAppError, type AppErrorCode } from "./errors"

/**
 * Serializable error shape returned to the client. AppError instances can't
 * cross the server action boundary, so actions return this instead.
 */
export type ResultError = {
  code: AppErrorCode
  message: string
  fieldErrors?: Record<string, string[]>
}

export type Result<T, E = ResultError> =
  { ok: true; data: T } | { ok: false; error: E }

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data }
}

export function err<E = ResultError>(error: E): Result<never, E> {
  return { ok: false, error }
}

const internalError: ResultError = {
  code: "INTERNAL",
  message: "Something went wrong on our side. Try again in a moment.",
}

/**
 * Converts anything caught in a server action into a client-safe error.
 * Unexpected errors are logged and never leak their message.
 */
export function toResultError(error: unknown): ResultError {
  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
    }
  }
  console.error(error)
  return internalError
}
