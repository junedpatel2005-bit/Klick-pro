import { NextResponse } from "next/server";

export const ApiErrorCode = {
  authentication: "AUTHENTICATION_ERROR",
  authorization: "AUTHORIZATION_ERROR",
  conflict: "CONFLICT",
  internal: "INTERNAL_ERROR",
  notFound: "NOT_FOUND",
  rateLimited: "RATE_LIMITED",
  validation: "VALIDATION_ERROR",
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export function apiError(
  code: ApiErrorCode | string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
