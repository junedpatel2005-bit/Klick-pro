import * as Sentry from "@sentry/nextjs";

/**
 * Runs before React hydrates in the browser. The public DSN is safe to expose;
 * keep the authentication token and any other Sentry secrets server-only.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
