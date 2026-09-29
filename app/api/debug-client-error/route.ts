import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const logLine = `[${new Date().toISOString()}] CLIENT_ERROR: ${JSON.stringify(body, null, 2)}\n---\n`;
    console.error(">>> RECEIVED CLIENT ERROR IN BOUNDARY:", body);
    
    const logDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(path.join(logDir, "client-error.log"), logLine, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

