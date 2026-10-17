import { z } from "zod";
import type { ReportRequest } from "./types";

const reportRequestSchema = z.object({
  scope: z.enum(["all", "selected"]),
  ids: z.array(z.union([z.number().int(), z.string().min(1)])).optional(),
  pageSize: z.enum(["A4", "LETTER"]).optional(),
  orientation: z.enum(["portrait", "landscape"]).optional(),
});

export function parseReportRequest(body: unknown): ReportRequest | null {
  const parsed = reportRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}
