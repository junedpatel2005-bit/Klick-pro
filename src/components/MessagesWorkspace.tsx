"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  Briefcase,
  CheckCheck,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { capitalizeFirst } from "@/lib/utils";

export type ContactProject = {
  id: number;
  jobId: number;
  title: string;
  category: string | null;
  status: string;
  progress: number;
  completedMilestones: number;
  totalMilestones: number;
  isCompleted: boolean;
  updatedAt: string;
};

export type Contact = {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  conversationId: string | null;
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
  isAdminTeam?: boolean;
  email?: string | null;
  phone?: string | null;
  projects?: ContactProject[];
  activeProject?: ContactProject | null;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: number;
  receiverId: number;
  body: string;
  createdAt: string;
  readAt: string | null;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatProjectStatus(status: string) {
  switch (status) {
    case "READY_TO_START":
      return "Ready to Start";
    case "IN_PROGRESS":
      return "In Progress";
    case "AWAITING_CLIENT_REVIEW":
      return "In Review";
    case "REVISION_REQUESTED":
      return "Revision Requested";
    case "FINAL_WORK_SUBMITTED":
      return "Work Submitted";
    case "AWAITING_PROFESSIONAL_CONFIRMATION":
      return "Awaiting Confirmation";
    case "COMPLETED":
      return "Completed";
    case "CLOSED":
      return "Closed";
    default:
      return status.replace(/_/g, " ");
  }
}

function projectStatusColor(status: string, admin = false) {
  if (admin) {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "READY_TO_START":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "AWAITING_CLIENT_REVIEW":
      case "REVISION_REQUESTED":
      case "FINAL_WORK_SUBMITTED":
      case "AWAITING_PROFESSIONAL_CONFIRMATION":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "COMPLETED":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
  }
  switch (status) {
    case "IN_PROGRESS":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    case "READY_TO_START":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    case "AWAITING_CLIENT_REVIEW":
    case "REVISION_REQUESTED":
    case "FINAL_WORK_SUBMITTED":
    case "AWAITING_PROFESSIONAL_CONFIRMATION":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    case "COMPLETED":
      return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20";
    default:
      return "bg-primary/10 text-primary border-primary/20";
  }
}

function MessagesWorkspaceInner({ admin = false }: { admin?: boolean }) {
  const searchParams = useSearchParams();
  const queryUserId =
    searchParams.get("recipientId") || searchParams.get("user") || searchParams.get("userId");
  const queryProjectId = searchParams.get("projectId") || searchParams.get("project");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(
    queryUserId && Number.isSafeInteger(Number(queryUserId)) ? Number(queryUserId) : null,
  );
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    queryProjectId && Number.isSafeInteger(Number(queryProjectId)) ? Number(queryProjectId) : null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [adminTab, setAdminTab] = useState<"ALL_CHATS" | "CLIENT" | "PROFESSIONAL">("ALL_CHATS");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [myUserId, setMyUserId] = useState<number | null>(null);

  const loadContacts = useCallback(async () => {
    const params = new URLSearchParams();
    if (queryUserId) params.set("recipientId", queryUserId);
    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`/api/v1/messages${queryStr}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load messages.");
    const data = (await response.json()) as { contacts: Contact[] };
    setContacts(data.contacts);
    setSelectedId((current) => {
      if (current && data.contacts.some((c) => c.id === current)) return current;
      if (queryUserId && Number.isSafeInteger(Number(queryUserId))) {
        const matching = data.contacts.find((c) => c.id === Number(queryUserId));
        if (matching) return matching.id;
      }
      return data.contacts[0]?.id ?? null;
    });
  }, [queryUserId]);

  useEffect(() => {
    void Promise.all([
      loadContacts(),
      fetch("/api/v1/auth/me")
        .then((response) => response.json())
        .then((data: { user?: { id?: number | string } }) =>
          setMyUserId(data.user?.id ? Number(data.user.id) : null),
        ),
    ])
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load messages."),
      )
      .finally(() => {
        setLoading(false);
        void fetch("/api/v1/messages", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ all: true }),
        }).then(() => {
          setContacts((current) => current.map((contact) => ({ ...contact, unreadCount: 0 })));
          window.dispatchEvent(new CustomEvent("servio:message-read"));
        });
      });

    const socket = io({ path: "/api/realtime", withCredentials: true });

    socket.on("message:new", (message: ChatMessage) => {
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
      void loadContacts().catch(() => undefined);
    });

    socket.on(
      "message:read",
      (receipt: { conversationId: string; messageIds: string[]; readAt: string }) => {
        setMessages((current) =>
          current.map((message) =>
            receipt.conversationId === message.conversationId &&
            receipt.messageIds.includes(message.id)
              ? { ...message, readAt: receipt.readAt }
              : message,
          ),
        );
      },
    );

    // Refresh contacts automatically when a new project starts or changes status
    const onProjectUpdate = () => {
      void loadContacts().catch(() => undefined);
    };
    socket.on("project:updated", onProjectUpdate);
    window.addEventListener("servio:project-update", onProjectUpdate);

    return () => {
      socket.disconnect();
      window.removeEventListener("servio:project-update", onProjectUpdate);
    };
  }, [loadContacts]);

  const unreadChatsCount = useMemo(
    () => contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [contacts],
  );
  const clientUnread = useMemo(
    () =>
      contacts.filter((c) => c.role === "CLIENT").reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [contacts],
  );
  const proUnread = useMemo(
    () =>
      contacts
        .filter((c) => c.role === "PROFESSIONAL")
        .reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [contacts],
  );
  const activeChatsCount = useMemo(
    () => contacts.filter((c) => Boolean(c.conversationId || c.lastMessage)).length,
    [contacts],
  );

  useEffect(() => {
    if (!admin || search.trim().length < 2) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: search.trim() });
      if (queryUserId) params.set("recipientId", queryUserId);
      void fetch(`/api/v1/messages?${params.toString()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { contacts?: Contact[] } | null) => {
          if (data?.contacts) {
            setContacts((prev) => {
              const map = new Map(prev.map((c) => [c.id, c]));
              for (const c of data.contacts!) map.set(c.id, c);
              return Array.from(map.values());
            });
          }
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [admin, search, queryUserId]);

  const visibleContacts = useMemo(
    () =>
      contacts.filter((contact) => {
        if (admin) {
          if (
            adminTab === "ALL_CHATS" &&
            !contact.conversationId &&
            !contact.lastMessage &&
            contact.id !== selectedId
          ) {
            return false;
          }
          if (adminTab === "CLIENT" && contact.role !== "CLIENT") return false;
          if (adminTab === "PROFESSIONAL" && contact.role !== "PROFESSIONAL") return false;
        }
        const q = search.toLowerCase();
        return (
          contact.name.toLowerCase().includes(q) ||
          (contact.email && contact.email.toLowerCase().includes(q)) ||
          (contact.phone && contact.phone.includes(q))
        );
      }),
    [admin, adminTab, contacts, search, selectedId],
  );

  const selected = contacts.find((contact) => contact.id === selectedId) ?? null;
  const isSelectedAdmin = selected?.role === "ADMIN" || Boolean(selected?.isAdminTeam);

  // Compute the current active project for the selected contact
  const currentProject = useMemo(() => {
    if (!selected) return null;
    if (selectedProjectId && selected.projects?.length) {
      const match = selected.projects.find((project) => project.id === selectedProjectId);
      if (match) return match;
    }
    return selected.activeProject ?? selected.projects?.[0] ?? null;
  }, [selected, selectedProjectId]);

  useEffect(() => {
    if (admin && selected) {
      if (adminTab !== "ALL_CHATS" && selected.role !== adminTab) {
        setSelectedId(visibleContacts[0]?.id ?? null);
      }
    }
  }, [admin, adminTab, selected, visibleContacts]);

  useEffect(() => {
    if (!selected?.conversationId) {
      setMessages([]);
      return;
    }
    void fetch(`/api/v1/messages?conversationId=${encodeURIComponent(selected.conversationId)}`)
      .then((response) => response.json())
      .then((data: { conversation?: { messages?: ChatMessage[] } }) =>
        setMessages(data.conversation?.messages ?? []),
      )
      .catch(() => setError("Unable to open this conversation."));
    void fetch("/api/v1/messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: selected.conversationId }),
    }).then(() => {
      setContacts((current) =>
        current.map((contact) =>
          contact.id === selected.id ? { ...contact, unreadCount: 0 } : contact,
        ),
      );
      window.dispatchEvent(new CustomEvent("servio:message-read"));
    });
  }, [selected?.conversationId, selected?.id]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selected || !text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientId: selected.id,
          text,
          projectId: currentProject?.id,
          job: currentProject?.title,
        }),
      });
      const data = (await response.json()) as {
        message?: ChatMessage;
        conversationId?: string;
        error?: string;
      };
      if (!response.ok || !data.message)
        throw new Error(data.error ?? "Message could not be sent.");
      setMessages((current) =>
        current.some((item) => item.id === data.message?.id)
          ? current
          : [...current, data.message!],
      );
      if (data.conversationId) {
        setContacts((current) =>
          current.map((c) =>
            c.id === selected.id
              ? { ...c, conversationId: data.conversationId!, lastMessage: data.message! }
              : c,
          ),
        );
      }
      setText("");
      await loadContacts();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${admin ? "border-slate-200 bg-white shadow-xs" : "border-border bg-card shadow-soft"}`}
    >
      <div
        className={`border-b p-5 sm:p-6 ${admin ? "border-slate-200 bg-slate-50/70" : "border-border"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p
              className={`text-xs font-bold uppercase tracking-[.2em] ${admin ? "text-indigo-600" : "text-primary"}`}
            >
              {admin ? "Admin Module" : "Messages"}
            </p>
            <h1 className={`mt-1 font-display text-2xl font-bold ${admin ? "text-slate-900" : ""}`}>
              {admin ? "Official Messages & Support" : "Stay connected"}
            </h1>
            <p className={`mt-1 text-sm ${admin ? "text-slate-500" : "text-muted-foreground"}`}>
              {admin
                ? "Review conversations and send direct support messages to clients and professionals."
                : "Chat with people connected to your active projects."}
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              admin
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-emerald-400/10 text-emerald-400"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />{" "}
            {admin ? "Live Support" : "Live chat"}
          </div>
        </div>
      </div>
      <div className="grid min-h-[620px] lg:grid-cols-[330px_1fr]">
        <aside
          className={`border-b lg:border-b-0 lg:border-r ${admin ? "border-slate-200 bg-white" : "border-border"}`}
        >
          {admin && (
            <div className="border-b border-slate-200 p-3 bg-slate-50/60">
              <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1">
                {(
                  [
                    {
                      key: "ALL_CHATS",
                      label: "All Chats",
                      count: activeChatsCount,
                      unread: unreadChatsCount,
                    },
                    { key: "CLIENT", label: "Clients", unread: clientUnread },
                    { key: "PROFESSIONAL", label: "Pros", unread: proUnread },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAdminTab(tab.key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      adminTab === tab.key
                        ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.unread > 0 ? (
                      <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                        {tab.unread > 99 ? "99+" : tab.unread}
                      </span>
                    ) : tab.key === "ALL_CHATS" && tab.count > 0 ? (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[9px] font-medium text-slate-600 border border-slate-200">
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div
            className={`border-b p-3.5 ${admin ? "border-slate-200 bg-white" : "border-border"}`}
          >
            <label
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                admin
                  ? "border border-slate-200 bg-slate-50 text-slate-700 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 shadow-2xs"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Search className={`h-4 w-4 ${admin ? "text-slate-400" : ""}`} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`w-full bg-transparent outline-none ${
                  admin
                    ? "text-slate-900 placeholder:text-slate-400"
                    : "placeholder:text-muted-foreground"
                }`}
                placeholder="Search people…"
              />
            </label>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-2">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading contacts…</p>
            ) : visibleContacts.length ? (
              visibleContacts.map((contact) => (
                <button
                  type="button"
                  key={contact.id}
                  onClick={() => {
                    setSelectedId(contact.id);
                    if (contact.activeProject) {
                      setSelectedProjectId(contact.activeProject.id);
                    }
                  }}
                  className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                    selectedId === contact.id
                      ? admin
                        ? "bg-indigo-50/80 border border-indigo-200/80 text-indigo-950 font-semibold shadow-2xs"
                        : "bg-primary/10"
                      : admin
                        ? "border border-transparent hover:bg-slate-50 text-slate-700"
                        : "hover:bg-muted"
                  }`}
                >
                  <div
                    className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full font-semibold border ${
                      !admin && (contact.role === "ADMIN" || contact.isAdminTeam)
                        ? "bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white shadow-xs border-indigo-700"
                        : admin
                          ? contact.role === "PROFESSIONAL"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                          : "bg-primary/15 text-primary border-primary/20"
                    }`}
                  >
                    {!admin && (contact.role === "ADMIN" || contact.isAdminTeam) ? (
                      <ShieldCheck className="h-6 w-6 text-white" />
                    ) : (
                      <>
                        {initials(contact.name)}
                        {contact.avatarUrl && (
                          <img
                            src={contact.avatarUrl}
                            alt=""
                            className="absolute h-full w-full rounded-full object-cover"
                            onError={(event) => event.currentTarget.remove()}
                          />
                        )}
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p
                          className={`shrink-0 text-sm font-semibold truncate ${
                            !admin && (contact.role === "ADMIN" || contact.isAdminTeam)
                              ? "text-indigo-600 dark:text-indigo-400 font-bold"
                              : admin
                                ? "text-slate-900"
                                : ""
                          }`}
                        >
                          {contact.name}
                        </p>
                        {!admin && (contact.role === "ADMIN" || contact.isAdminTeam) && (
                          <span className="shrink-0 rounded-full bg-indigo-500/15 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                            Support
                          </span>
                        )}
                        {admin && (
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-semibold border ${
                              contact.role === "PROFESSIONAL"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-sky-50 text-sky-700 border-sky-200"
                            }`}
                          >
                            {contact.role === "PROFESSIONAL" ? "Pro" : "Client"}
                          </span>
                        )}
                        {/* Show project name in bracket next to the contact name */}
                        {contact.activeProject && (
                          <span
                            className="truncate text-xs font-normal text-muted-foreground"
                            title={contact.activeProject.title}
                          >
                            ({contact.activeProject.title})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {contact.lastMessage && (
                          <span
                            className={`text-[10px] ${admin ? "text-slate-400" : "text-muted-foreground"}`}
                          >
                            {new Date(contact.lastMessage.createdAt).toLocaleDateString()}
                          </span>
                        )}
                        {contact.unreadCount > 0 && (
                          <span
                            className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ${admin ? "bg-indigo-600 text-white" : "bg-primary text-primary-foreground"}`}
                          >
                            {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Milestone & Completion Status Badge on Sidebar */}
                    {contact.activeProject && (
                      <div className="my-1 flex items-center gap-1.5 overflow-hidden">
                        {contact.activeProject.isCompleted ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCheck className="h-3 w-3 stroke-[3]" />
                            Project Completed
                          </span>
                        ) : (
                          <span
                            className={`inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${projectStatusColor(contact.activeProject.status, admin)}`}
                            title={`${contact.activeProject.progress}% • ${contact.activeProject.totalMilestones > 0 ? `${contact.activeProject.completedMilestones}/${contact.activeProject.totalMilestones} milestones completed` : formatProjectStatus(contact.activeProject.status)}`}
                          >
                            <Briefcase className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {contact.activeProject.progress}%
                              {contact.activeProject.totalMilestones > 0
                                ? ` • ${contact.activeProject.completedMilestones}/${contact.activeProject.totalMilestones} milestones`
                                : ` • ${formatProjectStatus(contact.activeProject.status)}`}
                            </span>
                          </span>
                        )}
                        {contact.projects && contact.projects.length > 1 && (
                          <span
                            className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                            title={`${contact.projects.length} connected projects`}
                          >
                            +{contact.projects.length - 1}
                          </span>
                        )}
                      </div>
                    )}

                    {admin && contact.email && !contact.activeProject && (
                      <p className="truncate text-[11px] text-slate-400">{contact.email}</p>
                    )}

                    <p
                      className={`truncate text-xs ${admin ? "text-slate-500" : "text-muted-foreground"}`}
                    >
                      {capitalizeFirst(
                        contact.lastMessage?.body ??
                          (!admin && (contact.role === "ADMIN" || contact.isAdminTeam)
                            ? "Official KLICK-PRO Help & Support"
                            : "Start a conversation"),
                      )}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-6 text-center">
                <div
                  className={`mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl ${
                    admin
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <MessageCircle className="h-5 w-5" />
                </div>
                <p
                  className={`text-xs font-medium ${
                    admin ? "text-slate-600" : "text-muted-foreground"
                  }`}
                >
                  {admin ? "No messages in this tab." : "No conversations yet."}
                </p>
                {admin && (
                  <Link
                    href="/admin/users"
                    className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    View All Users
                  </Link>
                )}
              </div>
            )}
          </div>
        </aside>
        <div className={`flex min-h-[620px] flex-col ${admin ? "bg-slate-50/50" : ""}`}>
          {selected ? (
            <>
              <header
                className={`flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5 ${admin ? "border-slate-200 bg-white" : "border-border"}`}
              >
                {!admin && isSelectedAdmin ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white shadow-xs font-semibold">
                      <ShieldCheck className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-indigo-600 dark:text-indigo-400">
                          KLICK-PRO Team
                        </p>
                        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                          Official Support
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        Direct support line with KLICK-PRO team
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-semibold border ${
                        admin
                          ? selected.role === "PROFESSIONAL"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {initials(selected.name)}
                      {selected.avatarUrl && (
                        <img
                          src={selected.avatarUrl}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                          onError={(event) => event.currentTarget.remove()}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`truncate font-bold ${admin ? "text-slate-900" : ""}`}>
                          {selected.name}
                        </p>
                        {currentProject && (
                          <span
                            className="truncate text-xs font-normal text-muted-foreground hidden sm:inline"
                            title={currentProject.title}
                          >
                            ({currentProject.title})
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                            admin
                              ? selected.role === "PROFESSIONAL"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-sky-50 text-sky-700 border-sky-200"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {selected.role === "ADMIN"
                            ? "Admin support"
                            : selected.role === "PROFESSIONAL"
                              ? "Professional"
                              : "Client"}
                        </span>
                      </div>

                      {admin ? (
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {selected.email && (
                            <span
                              className="flex items-center gap-1 truncate"
                              title={selected.email}
                            >
                              <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              {selected.email}
                            </span>
                          )}
                          {selected.phone && (
                            <span className="flex items-center gap-1" title={selected.phone}>
                              <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              {selected.phone}
                            </span>
                          )}
                          <Link
                            href={`/admin/users/${selected.id}`}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 transition"
                          >
                            Profile <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      ) : (
                        currentProject && (
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden truncate">
                            <Briefcase className="h-3 w-3 shrink-0 text-primary" />
                            <span className="truncate font-medium">{currentProject.title}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Right Area of Header: Percentage, Milestones, or Project Completed */}
                {!admin && isSelectedAdmin ? (
                  <div className="ml-auto flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Verified Support</span>
                  </div>
                ) : currentProject ? (
                  <div className="flex items-center gap-3 ml-auto flex-wrap">
                    {currentProject.isCompleted ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-1.5 text-emerald-800 dark:text-emerald-300 shadow-2xs">
                        <div className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                          <CheckCheck className="h-3 w-3 stroke-[3]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-tight">Project Completed</p>
                          <p className="text-[10px] opacity-80 mt-0.5">
                            {currentProject.totalMilestones > 0
                              ? `${currentProject.totalMilestones}/${currentProject.totalMilestones} milestones completed`
                              : "100% completed"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-3 rounded-2xl border px-3.5 py-1.5 shadow-2xs ${
                          admin
                            ? "border-slate-200 bg-slate-50/80 text-slate-800"
                            : "border-border bg-muted/40 text-foreground"
                        }`}
                      >
                        {/* Progress percentage & visual bar */}
                        <div className="flex flex-col justify-center">
                          <div className="flex items-center justify-between gap-3 text-xs font-semibold leading-tight">
                            <span
                              className={`text-[11px] ${admin ? "text-slate-500" : "text-muted-foreground"}`}
                            >
                              Progress
                            </span>
                            <span className="text-primary font-bold">
                              {currentProject.progress}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-24 sm:w-28 overflow-hidden rounded-full bg-background border border-border/40">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{
                                width: `${Math.min(Math.max(currentProject.progress, 0), 100)}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="h-6 w-px bg-border shrink-0" />

                        {/* Milestone completion count */}
                        <div className="flex flex-col justify-center text-left">
                          <p className="text-xs font-semibold leading-tight">
                            {currentProject.totalMilestones > 0
                              ? `${currentProject.completedMilestones} of ${currentProject.totalMilestones} milestones completed`
                              : "No milestones yet"}
                          </p>
                          <p
                            className={`text-[10px] ${admin ? "text-slate-500" : "text-muted-foreground"} mt-0.5`}
                          >
                            Status:{" "}
                            <span
                              className={`font-medium ${admin ? "text-slate-900" : "text-foreground"}`}
                            >
                              {formatProjectStatus(currentProject.status)}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}

                    <Link
                      href={`/project/${currentProject.id}/tracking`}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        admin
                          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-indigo-300 shadow-2xs"
                          : "border-border bg-card text-foreground hover:bg-muted hover:border-primary/40 shadow-xs"
                      }`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-primary" />
                      <span className="hidden sm:inline">View Tracking</span>
                      <span className="sm:hidden">Tracking</span>
                    </Link>
                    {admin && <ShieldCheck className="h-5 w-5 text-indigo-600" />}
                  </div>
                ) : (
                  admin && (
                    <div className="ml-auto flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      <ShieldCheck className="h-4 w-4 text-indigo-600" />
                      <span>Official Support Thread</span>
                    </div>
                  )
                )}
              </header>

              {/* Multi-Project Switcher Bar (when 2 or more projects exist with this contact) */}
              {selected.projects && selected.projects.length > 1 && (
                <div
                  className={`flex items-center gap-2 border-b px-4 py-2 text-xs overflow-x-auto ${
                    admin ? "border-slate-200 bg-slate-50/70" : "border-border bg-muted/30"
                  }`}
                >
                  <span
                    className={`shrink-0 font-medium ${admin ? "text-slate-600" : "text-muted-foreground"}`}
                  >
                    Connected Projects ({selected.projects.length}):
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selected.projects.map((proj) => {
                      const isCurrent = currentProject?.id === proj.id;
                      return (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => setSelectedProjectId(proj.id)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                            isCurrent
                              ? admin
                                ? "border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs"
                                : "border-primary/30 bg-primary/10 text-primary shadow-xs"
                              : admin
                                ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                : "border-transparent bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="truncate max-w-[140px]">{proj.title}</span>
                          <span className="text-[10px] opacity-75">
                            • {proj.isCompleted ? "Completed" : `${proj.progress}%`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                className={`flex-1 space-y-3 overflow-y-auto p-4 sm:p-6 ${admin ? "bg-slate-50/60" : "bg-muted/30"}`}
              >
                {messages.length ? (
                  messages.map((message) => {
                    const isMine = message.senderId === myUserId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-2xs ${
                            isMine
                              ? admin
                                ? "rounded-br-md bg-indigo-600 text-white"
                                : "rounded-br-md bg-primary text-primary-foreground"
                              : admin
                                ? "rounded-bl-md bg-white border border-slate-200 text-slate-900"
                                : isSelectedAdmin
                                  ? "rounded-bl-md bg-slate-900 text-slate-100 dark:bg-slate-800 border border-indigo-500/30"
                                  : "rounded-bl-md bg-card"
                          }`}
                        >
                          {!admin && isSelectedAdmin && !isMine && (
                            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>KLICK-PRO Team</span>
                            </div>
                          )}
                          {admin && !isMine && (
                            <div className="mb-1 text-[11px] font-semibold text-indigo-600">
                              {selected.name}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{capitalizeFirst(message.body)}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              isMine
                                ? admin
                                  ? "text-white/80"
                                  : "text-primary-foreground/70"
                                : admin
                                  ? "text-slate-400"
                                  : isSelectedAdmin
                                    ? "text-slate-400"
                                    : "text-muted-foreground"
                            }`}
                          >
                            <span>
                              {new Date(message.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isMine && (
                              <span title={message.readAt ? "Seen" : "Sent"}>
                                <CheckCheck
                                  className={`ml-1 inline-block h-4 w-4 align-[-3px] stroke-[3] ${
                                    message.readAt
                                      ? "text-sky-200 drop-shadow-[0_0_2px_rgba(186,230,253,.75)]"
                                      : "text-white/70"
                                  }`}
                                  aria-label={message.readAt ? "Seen" : "Sent"}
                                />
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : !admin && isSelectedAdmin ? (
                  <div className="mx-auto my-auto max-w-md p-6 text-center text-muted-foreground">
                    <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white shadow-md">
                      <ShieldCheck className="h-8 w-8" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">
                      KLICK-PRO Support Team
                    </h3>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Have questions about your projects, milestone payments, disputes, or platform
                      features? Send a message below and our team will assist you.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      KLICK-PRO Team is active
                    </div>
                  </div>
                ) : (
                  <div
                    className={`mx-auto my-auto max-w-md p-6 text-center ${admin ? "text-slate-500" : "text-muted-foreground"}`}
                  >
                    <div
                      className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl ${
                        admin
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-200/80 shadow-2xs"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {currentProject ? (
                        <Briefcase className="h-7 w-7" />
                      ) : (
                        <MessageCircle className="h-7 w-7" />
                      )}
                    </div>
                    <h3
                      className={`text-base font-bold ${admin ? "text-slate-900" : "text-foreground"}`}
                    >
                      Connected with {selected.name}
                    </h3>
                    <p
                      className={`mt-1 text-xs ${admin ? "text-slate-500" : "text-muted-foreground"}`}
                    >
                      {admin
                        ? "Send an official support message to this user below."
                        : currentProject
                          ? "Collaborating on active project"
                          : "Start the conversation"}
                    </p>

                    {/* Empty state project details card */}
                    {currentProject && (
                      <div
                        className={`mt-4 rounded-2xl border p-4 text-left shadow-2xs ${
                          admin ? "border-slate-200 bg-white" : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              admin ? "text-indigo-600" : "text-primary"
                            }`}
                          >
                            Project Details
                          </span>
                          {currentProject.isCompleted ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCheck className="h-3 w-3 stroke-[3]" />
                              Project Completed
                            </span>
                          ) : (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${projectStatusColor(currentProject.status, admin)}`}
                            >
                              {formatProjectStatus(currentProject.status)}
                            </span>
                          )}
                        </div>
                        <p
                          className={`mt-1.5 font-bold text-sm ${admin ? "text-slate-900" : "text-foreground"}`}
                        >
                          {currentProject.title}
                        </p>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                          <span className="text-slate-500">
                            Progress: {currentProject.progress}%{" "}
                            {currentProject.totalMilestones > 0 &&
                              `(${currentProject.completedMilestones}/${currentProject.totalMilestones} milestones completed)`}
                          </span>
                          <Link
                            href={`/project/${currentProject.id}/tracking`}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline"
                          >
                            Open Tracking <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    )}

                    <p className="mt-4 text-xs text-muted-foreground">
                      Send a message below to coordinate project deliverables, updates, or
                      questions.
                    </p>
                  </div>
                )}
              </div>
              <form
                onSubmit={send}
                className={`flex gap-2 border-t p-4 ${admin ? "border-slate-200 bg-white" : "border-border"}`}
              >
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  className={`h-11 min-w-0 flex-1 rounded-xl border px-4 text-sm outline-none transition ${
                    admin
                      ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                      : "border-border bg-background focus:ring-primary/30"
                  }`}
                  placeholder={
                    admin
                      ? `Reply to ${selected.name} as KLICK-PRO Team…`
                      : isSelectedAdmin
                        ? "Type your message to KLICK-PRO Team…"
                        : "Type a message…"
                  }
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition shadow-2xs hover:opacity-90 disabled:opacity-50 ${
                    admin
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : isSelectedAdmin
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-primary text-primary-foreground"
                  }`}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div
              className={`grid flex-1 place-items-center p-8 text-center ${admin ? "text-slate-500 bg-slate-50/40" : "text-muted-foreground"}`}
            >
              <div>
                <div
                  className={`mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl ${
                    admin
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <MessageCircle className="h-7 w-7" />
                </div>
                <h3
                  className={`text-base font-bold ${admin ? "text-slate-900" : "text-foreground"}`}
                >
                  {admin ? "No conversation selected" : "Select a person to start chatting"}
                </h3>
                <p
                  className={`mt-1 text-xs max-w-sm mx-auto ${
                    admin ? "text-slate-500" : "text-muted-foreground"
                  }`}
                >
                  {admin
                    ? "Choose a conversation from the left, or click 'Message' on any user in User Management to begin."
                    : "Select a contact from the list to start or continue your conversation."}
                </p>
                {admin && (
                  <Link
                    href="/admin/users"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition"
                  >
                    Open User Management
                  </Link>
                )}
              </div>
            </div>
          )}
          {error && (
            <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function MessagesWorkspace({ admin = false }: { admin?: boolean }) {
  return (
    <Suspense
      fallback={
        <section className="overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-soft">
          <div className="h-10 w-48 animate-pulse rounded-xl bg-muted" />
          <div className="mt-4 h-64 animate-pulse rounded-2xl bg-muted/40" />
        </section>
      }
    >
      <MessagesWorkspaceInner admin={admin} />
    </Suspense>
  );
}
