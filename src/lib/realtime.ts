import "server-only";

export type RealtimeNotification = {
  id?: number;
  type: string;
  title: string;
  description: string;
  href: string;
  createdAt: string;
};

type RealtimeServer = {
  to(room: string): { emit(event: string, payload: unknown): void };
};

declare global {
  var __servioIo: RealtimeServer | undefined;
}

export function emitRealtimeNotification(
  userIds: number[],
  notification: Omit<RealtimeNotification, "createdAt"> & { createdAt?: string },
) {
  const io = globalThis.__servioIo;
  if (!io) return;
  const payload = {
    ...notification,
    createdAt: notification.createdAt ?? new Date().toISOString(),
  };
  for (const userId of userIds) io.to(`user:${userId}`).emit("notification:new", payload);
}

export function emitRealtimeMessage(userIds: number[], payload: unknown) {
  const io = globalThis.__servioIo;
  if (!io) return;
  for (const userId of userIds) io.to(`user:${userId}`).emit("message:new", payload);
}

export function emitRealtimeMessageRead(userIds: number[], payload: unknown) {
  const io = globalThis.__servioIo;
  if (!io) return;
  for (const userId of userIds) io.to(`user:${userId}`).emit("message:read", payload);
}

export function emitRealtimeProjectUpdate(
  userIds: number[],
  payload: { projectId: number | string },
) {
  const io = globalThis.__servioIo;
  if (!io) return;
  for (const userId of userIds) io.to(`user:${userId}`).emit("project:updated", payload);
}

export function emitRealtimeProposalNew(userIds: number[], payload: { jobId: number }) {
  const io = globalThis.__servioIo;
  if (!io) return;
  for (const userId of userIds) io.to(`user:${userId}`).emit("proposal:new", payload);
}

export function emitAdminEvent(event: string, payload: unknown = {}) {
  const io = globalThis.__servioIo;
  if (!io) return;
  io.to("admins").emit(event, payload);
}

export function emitAdminNotification(notification: {
  id?: number;
  type?: string;
  title: string;
  description?: string;
  href?: string;
  createdAt?: string;
}) {
  const io = globalThis.__servioIo;
  if (!io) return;
  const payload = {
    ...notification,
    type: notification.type ?? "ADMIN_ALERT",
    createdAt: notification.createdAt ?? new Date().toISOString(),
  };
  io.to("admins").emit("admin:notification", payload);
  io.to("admins").emit("notification:new", payload);
}

export function emitAdminOverviewUpdate(payload: unknown = {}) {
  emitAdminEvent("admin:overview-update", payload);
}

export function emitAdminVerificationsUpdate(payload: unknown = {}) {
  emitAdminEvent("admin:verifications-update", payload);
  emitAdminEvent("admin:overview-update", payload);
}

export function emitAdminOperationsUpdate(payload: unknown = {}) {
  emitAdminEvent("admin:operations-update", payload);
  emitAdminEvent("admin:overview-update", payload);
}

export function emitAdminUsersUpdate(payload: unknown = {}) {
  emitAdminEvent("admin:users-update", payload);
  emitAdminEvent("admin:overview-update", payload);
}
