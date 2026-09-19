/**
 * The session lookup run on every Socket.IO handshake in server.mjs.
 *
 * It lives here, rather than inline in server.mjs, because that file sits
 * outside the tsconfig include — nothing type-checks it, so a table or column
 * rename would only surface as a runtime failure in production. Importing the
 * same string into a test lets CI catch that instead.
 *
 * Plain .mjs on purpose: server.mjs runs under `node server.mjs` with no build
 * step, and TypeScript stripping is not enabled by default on Node 22.
 */
export const SOCKET_SESSION_QUERY =
  'SELECT s.revoked_at, s.expires_at, u."isActive" FROM sessions s JOIN "User" u ON s.user_id = u.id WHERE s.id = $1';
