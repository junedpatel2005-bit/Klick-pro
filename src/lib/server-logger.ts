import "server-only";
import * as Sentry from "@sentry/nextjs";

type LogContext = Record<string, string | number | boolean | null | undefined>;

/** Keep operational errors machine-readable without logging request bodies or secrets. */
export function logServerError(event: string, error: unknown, context: LogContext = {}) {
  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error(JSON.stringify({ level: "error", event, message, ...context }));
  Sentry.withScope((scope) => {
    scope.setTag("event", event);
    scope.setContext("servio", context);
    Sentry.captureException(error);
  });
}
