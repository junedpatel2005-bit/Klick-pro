import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const LOG_FILE = "client-error.log";

export async function POST(request: NextRequest) {
  // This appends to a file on the server disk with no authentication and no
  // size limit, so it is only ever enabled while developing locally.
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const body = await request.json().catch(() => ({}));
    const logLine = `[${new Date().toISOString()}] CLIENT_ERROR: ${JSON.stringify(body, null, 2)}\n---\n`;
    console.error(">>> RECEIVED CLIENT ERROR IN BOUNDARY:", body);

    const logDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, LOG_FILE);
    // Stop growing the file once it hits the cap so it cannot fill the disk.
    if (fs.existsSync(logPath) && fs.statSync(logPath).size >= MAX_LOG_BYTES)
      return NextResponse.json({ ok: true, dropped: true });

    fs.appendFileSync(logPath, logLine, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
