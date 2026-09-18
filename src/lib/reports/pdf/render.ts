import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

export async function renderReportPdf(document: Parameters<typeof renderToBuffer>[0]) {
  return renderToBuffer(document);
}

export function pdfResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
