/**
 * Absolute safety ceiling for a hire-request bid, used only as a fallback when the
 * selected job has no budget range (e.g. hourly jobs). When a job has a budget range,
 * the bid must instead fall within that job's own budgetMin–budgetMax.
 */
export const MAX_HIRE_REQUEST_BUDGET = 10_000_000;
