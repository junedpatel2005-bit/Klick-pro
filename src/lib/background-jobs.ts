import "server-only";
import { logServerError } from "@/lib/server-logger";

type BackgroundContext = Record<string, boolean | number | string | null | undefined>;

/**
 * Runs non-critical outbound work after the request's business transaction has completed.
 * The interface deliberately keeps queue-provider code out of route handlers, so a durable
 * queue can replace this in-process executor without changing callers.
 */
export function enqueueBackgroundJob(
  name: string,
  task: () => Promise<void>,
  context: BackgroundContext = {},
) {
  void Promise.resolve()
    .then(task)
    .catch((error) => logServerError("background.job.failed", error, { job: name, ...context }));
}
