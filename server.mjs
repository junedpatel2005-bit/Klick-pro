import "dotenv/config";
import { createServer } from "node:http";
import { parse } from "node:url";
import { jwtVerify } from "jose";
import next from "next";
import pg from "pg";
import { Server } from "socket.io";
import { SOCKET_SESSION_QUERY } from "./src/lib/socket-session-sql.mjs";

const { Pool } = pg;

// Without a database the socket handshake cannot check whether a session has
// been revoked or the account deactivated, and it would accept both. Degrading
// that way is acceptable while developing, never in production.
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required in production: without it the realtime handshake cannot verify session revocation.",
  );
}
if (!process.env.DATABASE_URL) {
  console.warn(
    "[servio] DATABASE_URL is not set - realtime connections will skip the session revocation check.",
  );
}

// One small lookup per socket handshake. Kept at max 1 so this pool does not
// consume connections the request path needs (see the pool in src/lib/db.ts).
const dbPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 30000 })
  : null;

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? 3000);
const useWebpack = process.env.NEXT_WEBPACK === "1" || process.env.NEXT_WEBPACK === "true";
const app = next({
  dev,
  hostname,
  port,
  ...(dev && useWebpack ? { webpack: true } : {}),
});
const handler = app.getRequestHandler();
const allowedOrigin = process.env.REALTIME_ALLOWED_ORIGIN ?? process.env.APP_URL;

function cookieValue(cookieHeader, name) {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim().split("=", 2))
    .find(([key]) => key === name)?.[1];
}

await app.prepare();
const httpServer = createServer((request, response) => {
  const parsedUrl = parse(request.url, true);
  handler(request, response, parsedUrl);
});
const io = new Server(httpServer, {
  path: "/api/realtime",
  cors: allowedOrigin ? { origin: allowedOrigin, credentials: true } : undefined,
});
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

io.use(async (socket, nextSocket) => {
  try {
    const token = cookieValue(socket.handshake.headers.cookie, "servio_session");
    if (!token || !process.env.AUTH_SECRET) throw new Error("Missing session");
    const { payload } = await jwtVerify(token, secret);
    const userId = Number(payload.userId);
    if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("Invalid session");

    if (dbPool && typeof payload.sessionId === "string") {
      const { rows } = await dbPool.query(SOCKET_SESSION_QUERY, [payload.sessionId]);
      const sessionRow = rows[0];
      if (
        !sessionRow ||
        sessionRow.revoked_at ||
        new Date(sessionRow.expires_at) <= new Date() ||
        !sessionRow.isActive
      ) {
        throw new Error("Revoked or inactive session");
      }
    }

    socket.data.userId = userId;
    socket.data.role = payload.role;
    nextSocket();
  } catch {
    nextSocket(new Error("Unauthorized realtime connection"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);
  if (socket.data.role === "ADMIN") {
    socket.join("admins");
    socket.join("admin:room");
  }
});
globalThis.__servioIo = io;

const LOOPBACK_ALIASES = new Set(["0.0.0.0", "::", "127.0.0.1", "::1"]);
const browseHost = LOOPBACK_ALIASES.has(hostname) ? "localhost" : hostname;

httpServer.listen(port, hostname, () => {
  console.log(`> Servio ready on http://${browseHost}:${port} (bound to ${hostname})`);
});
