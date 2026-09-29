import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { emitRealtimeMessage, emitRealtimeMessageRead, emitAdminEvent } from "@/lib/realtime";
import { notifyUsers } from "@/lib/marketplace-notifications";

async function getSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

function pairWhere(firstId: number, secondId: number) {
  return {
    OR: [
      { userAId: firstId, userBId: secondId },
      { userAId: secondId, userBId: firstId },
    ],
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const allAdmins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      email: true,
      phone: true,
    },
    orderBy: { id: "asc" },
  });
  const primaryAdmin = allAdmins[0] ?? null;
  const allAdminIds = new Set(allAdmins.map((a) => a.id));
  const adminIdsArray = Array.from(allAdminIds);

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (conversationId) {
    const conversation = await db.socketConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
    });
    if (!conversation)
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const allowed =
      session.role === "ADMIN"
        ? allAdminIds.has(conversation.userAId) || allAdminIds.has(conversation.userBId)
        : conversation.userAId === session.userId || conversation.userBId === session.userId;
    if (!allowed)
      return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
    return NextResponse.json({ conversation });
  }

  const allUserProjectsRaw =
    session.role === "ADMIN"
      ? []
      : await db.projectTracking.findMany({
          where: {
            ...(session.role === "CLIENT"
              ? { clientId: session.userId }
              : { professionalId: session.userId }),
          },
          include: {
            job: { select: { id: true, title: true, category: true } },
            milestones: {
              select: {
                id: true,
                status: true,
                payment: { select: { status: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        });

  const allUserProjects = allUserProjectsRaw.map((p) => {
    const completedMilestones = p.milestones.filter(
      (m) => m.status === "APPROVED" || m.payment?.status === "COMPLETED",
    ).length;
    const totalMilestones = p.milestones.length;
    const isCompleted = p.status === "COMPLETED";
    const calcProgress = isCompleted
      ? 100
      : totalMilestones > 0
        ? Math.max(p.progress, Math.round((completedMilestones / totalMilestones) * 100))
        : p.progress;

    return {
      ...p,
      completedMilestones,
      totalMilestones,
      isCompleted,
      calcProgress,
    };
  });

  // Load conversations: for admin, ONLY load conversations where an admin is a participant
  const conversations = await db.socketConversation.findMany({
    where:
      session.role === "ADMIN"
        ? {
            OR: [{ userAId: { in: adminIdsArray } }, { userBId: { in: adminIdsArray } }],
          }
        : { OR: [{ userAId: session.userId }, { userBId: session.userId }] },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  // For admin: gather only users who have active conversations with admin
  const adminChatPartnerIds = new Set<number>();
  if (session.role === "ADMIN") {
    for (const c of conversations) {
      if (allAdminIds.has(c.userAId) && !allAdminIds.has(c.userBId)) {
        adminChatPartnerIds.add(c.userBId);
      } else if (allAdminIds.has(c.userBId) && !allAdminIds.has(c.userAId)) {
        adminChatPartnerIds.add(c.userAId);
      }
    }
  }

  // Also include explicitly targeted recipientId if admin clicked "Message" in user management
  const queryRecipientId =
    request.nextUrl.searchParams.get("recipientId") ||
    request.nextUrl.searchParams.get("user") ||
    request.nextUrl.searchParams.get("userId");
  if (
    session.role === "ADMIN" &&
    queryRecipientId &&
    Number.isSafeInteger(Number(queryRecipientId))
  ) {
    adminChatPartnerIds.add(Number(queryRecipientId));
  }

  // Optional search query for admin to search users by name or email
  const searchQuery = request.nextUrl.searchParams.get("search")?.trim().toLowerCase();
  let searchUserIds: number[] = [];
  if (session.role === "ADMIN" && searchQuery && searchQuery.length >= 2) {
    const matchingUsers = await db.user.findMany({
      where: {
        role: { not: "ADMIN" },
        OR: [
          { firstName: { contains: searchQuery, mode: "insensitive" } },
          { lastName: { contains: searchQuery, mode: "insensitive" } },
          { email: { contains: searchQuery, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 20,
    });
    searchUserIds = matchingUsers.map((u) => u.id);
  }

  const contactIds =
    session.role === "ADMIN"
      ? undefined
      : [
          ...new Set(
            allUserProjects.map((project) =>
              session.role === "CLIENT" ? project.professionalId : project.clientId,
            ),
          ),
        ];
  const existingUserConversations =
    session.role === "ADMIN"
      ? []
      : await db.socketConversation.findMany({
          where: { OR: [{ userAId: session.userId }, { userBId: session.userId }] },
          select: { userAId: true, userBId: true },
        });
  const conversationPartnerIds = existingUserConversations.map((conversation) =>
    conversation.userAId === session.userId ? conversation.userBId : conversation.userAId,
  );
  const adminConversationUsers =
    session.role === "ADMIN"
      ? []
      : await db.user.findMany({
          where: { id: { in: conversationPartnerIds }, role: "ADMIN" },
          select: { id: true },
        });
  const adminConversationContactIds = adminConversationUsers.map((user) => user.id);
  const allowedContactIds = [
    ...new Set([
      ...(contactIds ?? []),
      ...adminConversationContactIds,
      ...conversationPartnerIds,
      ...(primaryAdmin && session.role !== "ADMIN" ? [primaryAdmin.id] : []),
    ]),
  ];
  const contacts = await db.user.findMany({
    where:
      session.role === "ADMIN"
        ? { role: { in: ["CLIENT", "PROFESSIONAL"] } }
        : { id: { in: allowedContactIds }, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      email: true,
      phone: true,
    },
    orderBy: { firstName: "asc" },
  });

  const unreadBySender = await db.socketMessage.groupBy({
    by: ["senderId"],
    where: {
      receiverId: session.role === "ADMIN" ? { in: Array.from(allAdminIds) } : session.userId,
      readAt: null,
    },
    _count: { _all: true },
  });
  const unreadCounts = new Map(unreadBySender.map((item) => [item.senderId, item._count._all]));
  const contactRows = contacts.map((contact) => {
    const isContactAdmin = contact.role === "ADMIN";
    const conversation = conversations.find(
      (item) =>
        (session.role === "ADMIN" &&
          ((allAdminIds.has(item.userAId) && item.userBId === contact.id) ||
            (allAdminIds.has(item.userBId) && item.userAId === contact.id))) ||
        (item.userAId === session.userId && item.userBId === contact.id) ||
        (item.userAId === contact.id && item.userBId === session.userId),
    );
    const userProjects = allUserProjects.filter((p) =>
      session.role === "CLIENT" ? p.professionalId === contact.id : p.clientId === contact.id,
    );
    const runningProject =
      userProjects.find((p) => p.status === "IN_PROGRESS") ??
      userProjects.find((p) => !p.isCompleted && p.status !== "CLOSED") ??
      userProjects[0] ??
      null;

    return {
      ...contact,
      name:
        isContactAdmin && session.role !== "ADMIN"
          ? "KLICK-PRO Team"
          : `${contact.firstName} ${contact.lastName}`.trim() ||
            contact.email ||
            `User #${contact.id}`,
      isAdminTeam: isContactAdmin,
      conversationId: conversation?.id ?? null,
      lastMessage: conversation?.messages[0] ?? null,
      unreadCount: unreadCounts.get(contact.id) ?? 0,
      projects: userProjects.map((p) => ({
        id: p.id,
        jobId: p.jobId,
        title: p.job?.title ?? `Project #${p.jobId}`,
        category: p.job?.category ?? null,
        status: p.status,
        progress: p.calcProgress,
        completedMilestones: p.completedMilestones,
        totalMilestones: p.totalMilestones,
        isCompleted: p.isCompleted,
        updatedAt: p.updatedAt.toISOString(),
      })),
      activeProject: runningProject
        ? {
            id: runningProject.id,
            jobId: runningProject.jobId,
            title: runningProject.job?.title ?? `Project #${runningProject.jobId}`,
            category: runningProject.job?.category ?? null,
            status: runningProject.status,
            progress: runningProject.calcProgress,
            completedMilestones: runningProject.completedMilestones,
            totalMilestones: runningProject.totalMilestones,
            isCompleted: runningProject.isCompleted,
            updatedAt: runningProject.updatedAt.toISOString(),
          }
        : null,
    };
  });
  contactRows.sort((first, second) => {
    // For regular users, pin KLICK-PRO Team to the very top of contact list!
    if (session.role !== "ADMIN") {
      if (first.isAdminTeam && !second.isAdminTeam) return -1;
      if (!first.isAdminTeam && second.isAdminTeam) return 1;
    }
    // Users with unread messages come first
    if (second.unreadCount > 0 !== first.unreadCount > 0) {
      return second.unreadCount > 0 ? 1 : -1;
    }
    // For admin, users with active conversations come before users without conversations
    if (session.role === "ADMIN") {
      const firstHasChat = Boolean(first.conversationId || first.lastMessage);
      const secondHasChat = Boolean(second.conversationId || second.lastMessage);
      if (firstHasChat !== secondHasChat) {
        return secondHasChat ? 1 : -1;
      }
    }
    const firstTime = first.lastMessage?.createdAt
      ? new Date(first.lastMessage.createdAt).getTime()
      : 0;
    const secondTime = second.lastMessage?.createdAt
      ? new Date(second.lastMessage.createdAt).getTime()
      : 0;
    if (firstTime !== secondTime) return secondTime - firstTime;
    return first.name.localeCompare(second.name);
  });
  return NextResponse.json({ role: session.role, contacts: contactRows });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  const body = (await request.json()) as { conversationId?: string; all?: boolean };
  const allAdmins =
    session.role === "ADMIN"
      ? await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
      : [];
  const adminIds = allAdmins.map((a) => a.id);
  const receiverFilter = session.role === "ADMIN" ? { in: adminIds } : session.userId;

  if (body.all === true) {
    const unreadMessages = await db.socketMessage.findMany({
      where: { receiverId: receiverFilter, readAt: null },
      select: { id: true, senderId: true, conversationId: true },
    });
    await db.socketMessage.updateMany({
      where: { receiverId: receiverFilter, readAt: null },
      data: { readAt: new Date() },
    });
    const readAt = new Date().toISOString();
    const bySender = new Map<number, { messageIds: string[]; conversationIds: Set<string> }>();
    for (const message of unreadMessages) {
      const entry = bySender.get(message.senderId) ?? {
        messageIds: [],
        conversationIds: new Set<string>(),
      };
      entry.messageIds.push(message.id);
      entry.conversationIds.add(message.conversationId);
      bySender.set(message.senderId, entry);
    }
    for (const [senderId, entry] of bySender) {
      for (const conversationId of entry.conversationIds) {
        emitRealtimeMessageRead([senderId], {
          conversationId,
          messageIds: entry.messageIds,
          readAt,
        });
      }
    }
    return NextResponse.json({ success: true });
  }
  if (!body.conversationId)
    return NextResponse.json({ error: "Conversation is required." }, { status: 400 });
  const conversation = await db.socketConversation.findUnique({
    where: { id: body.conversationId },
  });
  if (!conversation)
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (
    session.role !== "ADMIN" &&
    conversation.userAId !== session.userId &&
    conversation.userBId !== session.userId
  ) {
    return NextResponse.json({ error: "Conversation access denied." }, { status: 403 });
  }
  const unreadMessages = await db.socketMessage.findMany({
    where: { conversationId: body.conversationId, receiverId: receiverFilter, readAt: null },
    select: { id: true, senderId: true },
  });
  await db.socketMessage.updateMany({
    where: { conversationId: body.conversationId, receiverId: receiverFilter, readAt: null },
    data: { readAt: new Date() },
  });
  const readAt = new Date().toISOString();
  emitRealtimeMessageRead([...new Set(unreadMessages.map((message) => message.senderId))], {
    conversationId: body.conversationId,
    messageIds: unreadMessages.map((message) => message.id),
    readAt,
  });
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  const body = (await request.json()) as {
    recipientId?: number;
    text?: string;
    job?: string;
    projectId?: number;
  };
  const recipientId = Number(body.recipientId);
  const text = body.text?.trim() ?? "";
  if (!Number.isSafeInteger(recipientId) || !text) {
    return NextResponse.json({ error: "Recipient and message are required." }, { status: 400 });
  }
  const recipient = await db.user.findUnique({
    where: { id: recipientId },
    select: { id: true, role: true, firstName: true, lastName: true, avatarUrl: true },
  });
  if (!recipient || (recipient.role === "ADMIN" && session.role === "ADMIN")) {
    return NextResponse.json({ error: "Recipient is unavailable." }, { status: 404 });
  }
  let activeProject = null;
  if (session.role !== "ADMIN" && recipient.role !== "ADMIN") {
    activeProject = await db.projectTracking.findFirst({
      where: {
        status: { not: "COMPLETED" },
        ...(session.role === "CLIENT"
          ? { clientId: session.userId, professionalId: recipientId }
          : { professionalId: session.userId, clientId: recipientId }),
        ...(body.projectId ? { id: Number(body.projectId) } : {}),
      },
      include: { job: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
    });
    if (!activeProject) {
      return NextResponse.json(
        { error: "Messaging is available for running projects only." },
        { status: 403 },
      );
    }
  }
  const sender = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true, avatarUrl: true, role: true },
  });
  const isSupportChat = session.role === "ADMIN" || recipient.role === "ADMIN";
  const supportAdmins = isSupportChat
    ? await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
    : [];
  const adminIdsArray = supportAdmins.map((a) => a.id);
  const existing = await db.socketConversation.findFirst({
    where: isSupportChat
      ? {
          OR: [
            { userAId: { in: adminIdsArray }, userBId: recipientId },
            { userAId: recipientId, userBId: { in: adminIdsArray } },
            pairWhere(session.userId, recipientId),
          ],
        }
      : pairWhere(session.userId, recipientId),
  });
  const resolvedJob = isSupportChat
    ? "KLICK-PRO Support"
    : body.job?.trim() || activeProject?.job?.title?.trim() || "Project conversation";
  const conversation =
    existing ??
    (await db.socketConversation.create({
      data: {
        id: randomUUID(),
        userAId: session.userId,
        userBId: recipientId,
        userAName:
          session.role === "ADMIN"
            ? "KLICK-PRO Team"
            : `${sender?.firstName ?? ""} ${sender?.lastName ?? ""}`.trim() || "User",
        userBName:
          recipient.role === "ADMIN"
            ? "KLICK-PRO Team"
            : `${recipient.firstName} ${recipient.lastName}`.trim(),
        userAAvatarUrl: sender?.avatarUrl ?? null,
        userBAvatarUrl: recipient.avatarUrl,
        job: resolvedJob,
      },
    }));
  const message = await db.socketMessage.create({
    data: {
      id: randomUUID(),
      conversationId: conversation.id,
      senderId: session.userId,
      receiverId: recipientId,
      body: text,
    },
  });
  await db.socketConversation.update({
    where: { id: conversation.id },
    data: {
      updatedAt: new Date(),
      ...(existing &&
      resolvedJob &&
      (existing.job === "Project conversation" || existing.job === "Direct message")
        ? { job: resolvedJob }
        : {}),
    },
  });

  const allAdmins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const adminIds = allAdmins.map((a) => a.id);

  const senderName =
    session.role === "ADMIN"
      ? "KLICK-PRO Team"
      : `${sender?.firstName ?? ""} ${sender?.lastName ?? ""}`.trim() || "A user";
  const notification = {
    type: "NEW_MESSAGE",
    title: `New message from ${senderName}`,
    description: text.length > 120 ? `${text.slice(0, 117)}…` : text,
    href:
      recipient.role === "ADMIN"
        ? "/admin/messages"
        : recipient.role === "PROFESSIONAL"
          ? "/professional/messages"
          : "/messages",
  };

  if (recipient.role === "ADMIN") {
    await notifyUsers(adminIds, notification);
    emitRealtimeMessage([session.userId, ...adminIds], {
      ...message,
      conversationId: conversation.id,
    });
    emitAdminEvent("message:new", {
      ...message,
      conversationId: conversation.id,
    });
  } else {
    await notifyUsers([recipientId], notification);
    emitRealtimeMessage([session.userId, recipientId, ...adminIds], {
      ...message,
      conversationId: conversation.id,
    });
  }
  return NextResponse.json({ conversationId: conversation.id, message });
}
