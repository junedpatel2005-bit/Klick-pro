"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  Briefcase,
  CheckCheck,
  ExternalLink,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";

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
    return "bg-indigo-500/20 text-indigo-300 border-indigo-400/30";
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
  const [adminTab, setAdminTab] = useState<"CLIENT" | "PROFESSIONAL">("CLIENT");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [myUserId, setMyUserId] = useState<number | null>(null);

  const loadContacts = useCallback(async () => {
    const response = await fetch("/api/v1/messages", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load messages.");
    const data = (await response.json()) as { contacts: Contact[] };
    setContacts(data.contacts);
    setSelectedId((current) => {
      if (current) return current;
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

  const visibleContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          (!admin || contact.role === adminTab) &&
          contact.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [admin, adminTab, contacts, search],
  );

  const selected = contacts.find((contact) => contact.id === selectedId) ?? null;

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
    if (admin && selected && selected.role !== adminTab) {
      setSelectedId(visibleContacts[0]?.id ?? null);
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
      const data = (await response.json()) as { message?: ChatMessage; error?: string };
      if (!response.ok || !data.message)
        throw new Error(data.error ?? "Message could not be sent.");
      setMessages((current) =>
        current.some((item) => item.id === data.message?.id)
          ? current
          : [...current, data.message!],
      );
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
      className={`overflow-hidden rounded-3xl border shadow-soft ${admin ? "border-white/10 bg-[#11182b] text-white" : "border-border bg-card"}`}
    >
      <div className={`border-b p-5 sm:p-6 ${admin ? "border-white/10" : "border-border"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p
              className={`text-xs font-bold uppercase tracking-[.18em] ${admin ? "text-indigo-300" : "text-primary"}`}
            >
              Messages
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">Stay connected</h1>
            <p className={`mt-1 text-sm ${admin ? "text-slate-400" : "text-muted-foreground"}`}>
              {admin
                ? "Review and reply to client and professional conversations."
                : "Chat with people connected to your running projects."}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-success" /> Live chat
          </div>
        </div>
      </div>
      <div className="grid min-h-[620px] lg:grid-cols-[330px_1fr]">
        <aside
          className={`border-b lg:border-b-0 lg:border-r ${admin ? "border-white/10 bg-[#0d1426]" : "border-border"}`}
        >
          {admin && (
            <div className="border-b border-white/10 p-3">
              <div className="flex gap-1 rounded-xl bg-white/5 p-1">
                {(["CLIENT", "PROFESSIONAL"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setAdminTab(tab)}
                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition ${adminTab === tab ? "bg-indigo-500 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                  >
                    {tab === "CLIENT" ? "Clients" : "Professionals"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={`border-b p-4 ${admin ? "border-white/10" : "border-border"}`}>
            <label
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${admin ? "bg-white/5 text-slate-400" : "bg-muted text-muted-foreground"}`}
            >
              <Search className="h-4 w-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`w-full bg-transparent outline-none ${admin ? "text-white placeholder:text-slate-500" : "placeholder:text-muted-foreground"}`}
                placeholder="Search people"
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
                  className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${selectedId === contact.id ? (admin ? "bg-indigo-500/20" : "bg-primary/10") : admin ? "hover:bg-white/5" : "hover:bg-muted"}`}
                >
                  <div
                    className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full font-semibold ${admin ? "bg-indigo-400/20 text-indigo-200" : contact.role === "ADMIN" ? "bg-red-500/15 text-red-500" : "bg-primary/15 text-primary"}`}
                  >
                    {initials(contact.name)}
                    {contact.avatarUrl && (
                      <img
                        src={contact.avatarUrl}
                        alt=""
                        className="absolute h-full w-full rounded-full object-cover"
                        onError={(event) => event.currentTarget.remove()}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p
                          className={`shrink-0 text-sm font-semibold ${!admin && contact.role === "ADMIN" ? "text-red-500" : ""}`}
                        >
                          {contact.name}
                        </p>
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
                            className={`text-[10px] ${admin ? "text-slate-500" : "text-muted-foreground"}`}
                          >
                            {new Date(contact.lastMessage.createdAt).toLocaleDateString()}
                          </span>
                        )}
                        {contact.unreadCount > 0 && (
                          <span
                            className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ${admin ? "bg-indigo-500 text-white" : "bg-primary text-primary-foreground"}`}
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

                    <p
                      className={`truncate text-xs ${admin ? "text-slate-400" : "text-muted-foreground"}`}
                    >
                      {contact.lastMessage?.body ?? "Start a conversation"}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <p className={`p-4 text-sm ${admin ? "text-slate-400" : "text-muted-foreground"}`}>
                {admin ? "No people found." : "No active project conversations yet."}
              </p>
            )}
          </div>
        </aside>
        <div className={`flex min-h-[620px] flex-col ${admin ? "bg-[#0b1020]" : ""}`}>
          {selected ? (
            <>
              <header
                className={`flex flex-wrap items-center justify-between gap-3 border-b p-4 ${admin ? "border-white/10" : "border-border"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-semibold ${admin ? "bg-indigo-400/20 text-indigo-200" : selected.role === "ADMIN" ? "bg-red-500/15 text-red-500" : "bg-primary/15 text-primary"}`}
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
                      <p
                        className={`truncate font-semibold ${!admin && selected.role === "ADMIN" ? "text-red-500" : ""}`}
                      >
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
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${admin ? "bg-white/10 text-slate-300" : "bg-muted text-muted-foreground"}`}
                      >
                        {selected.role === "ADMIN"
                          ? "Admin support"
                          : selected.role === "PROFESSIONAL"
                            ? "Professional"
                            : "Client"}
                      </span>
                    </div>

                    {currentProject && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden truncate">
                        <Briefcase className="h-3 w-3 shrink-0 text-primary" />
                        <span className="truncate font-medium">{currentProject.title}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Area of Header: Percentage, Milestones, or Project Completed */}
                {currentProject ? (
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
                            ? "border-white/10 bg-white/5 text-slate-200"
                            : "border-border bg-muted/40 text-foreground"
                        }`}
                      >
                        {/* Progress percentage & visual bar */}
                        <div className="flex flex-col justify-center">
                          <div className="flex items-center justify-between gap-3 text-xs font-semibold leading-tight">
                            <span className="text-[11px] text-muted-foreground">Progress</span>
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
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Status:{" "}
                            <span className="font-medium text-foreground">
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
                          ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                          : "border-border bg-card text-foreground hover:bg-muted hover:border-primary/40 shadow-xs"
                      }`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-primary" />
                      <span className="hidden sm:inline">View Tracking</span>
                      <span className="sm:hidden">Tracking</span>
                    </Link>
                    {admin && <ShieldCheck className="h-5 w-5 text-indigo-300" />}
                  </div>
                ) : (
                  admin && <ShieldCheck className="h-5 w-5 text-indigo-300 ml-auto" />
                )}
              </header>

              {/* Multi-Project Switcher Bar (when 2 or more projects exist with this contact) */}
              {selected.projects && selected.projects.length > 1 && (
                <div
                  className={`flex items-center gap-2 border-b px-4 py-2 text-xs overflow-x-auto ${
                    admin ? "border-white/10 bg-[#0d1426]" : "border-border bg-muted/30"
                  }`}
                >
                  <span className="shrink-0 font-medium text-muted-foreground">
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
                                ? "border-indigo-400/40 bg-indigo-500/20 text-white"
                                : "border-primary/30 bg-primary/10 text-primary shadow-xs"
                              : admin
                                ? "border-transparent bg-white/5 text-slate-400 hover:text-white"
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
                className={`flex-1 space-y-3 overflow-y-auto p-4 sm:p-6 ${admin ? "bg-[#0b1020]" : "bg-muted/30"}`}
              >
                {messages.length ? (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === myUserId ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.senderId === myUserId ? (admin ? "rounded-br-md bg-indigo-500 text-white" : "rounded-br-md bg-primary text-primary-foreground") : admin ? "rounded-bl-md bg-[#18233b] text-slate-100" : selected.role === "ADMIN" ? "rounded-bl-md bg-red-500 text-white" : "rounded-bl-md bg-card"}`}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p
                          className={`mt-1 text-[10px] ${message.senderId === myUserId ? (admin ? "text-white/70" : "text-primary-foreground/70") : admin ? "text-slate-400" : "text-muted-foreground"}`}
                        >
                          <span>
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {message.senderId === myUserId && (
                            <span title={message.readAt ? "Seen" : "Sent"}>
                              <CheckCheck
                                className={`ml-1 inline-block h-4 w-4 align-[-3px] stroke-[3] ${message.readAt ? "text-[#55e6ff] drop-shadow-[0_0_3px_rgba(85,230,255,.75)]" : "text-white"}`}
                                aria-label={message.readAt ? "Seen" : "Sent"}
                              />
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    className={`mx-auto my-auto max-w-md p-6 text-center ${admin ? "text-slate-400" : "text-muted-foreground"}`}
                  >
                    <div
                      className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl ${
                        admin ? "bg-indigo-500/20 text-indigo-300" : "bg-primary/10 text-primary"
                      }`}
                    >
                      {currentProject ? (
                        <Briefcase className="h-7 w-7" />
                      ) : (
                        <MessageCircle className="h-7 w-7" />
                      )}
                    </div>
                    <h3
                      className={`text-base font-semibold ${admin ? "text-white" : "text-foreground"}`}
                    >
                      Connected with {selected.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {currentProject
                        ? "Collaborating on active project"
                        : "Start the conversation"}
                    </p>

                    {/* Empty state project details card */}
                    {currentProject && (
                      <div
                        className={`mt-4 rounded-2xl border p-4 text-left shadow-soft ${
                          admin ? "border-white/10 bg-[#141d33]" : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              admin ? "text-indigo-300" : "text-primary"
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
                          className={`mt-1.5 font-semibold text-sm ${admin ? "text-white" : "text-foreground"}`}
                        >
                          {currentProject.title}
                        </p>
                        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                          <span className="text-muted-foreground">
                            Progress: {currentProject.progress}%{" "}
                            {currentProject.totalMilestones > 0 &&
                              `(${currentProject.completedMilestones}/${currentProject.totalMilestones} milestones completed)`}
                          </span>
                          <Link
                            href={`/project/${currentProject.id}/tracking`}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
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
                className={`flex gap-2 border-t p-4 ${admin ? "border-white/10 bg-[#11182b]" : "border-border"}`}
              >
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  className={`h-11 min-w-0 flex-1 rounded-xl border px-4 text-sm outline-none focus:ring-2 ${admin ? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:ring-indigo-400/30" : "border-border bg-background focus:ring-primary/30"}`}
                  placeholder="Type a message…"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition hover:opacity-90 disabled:opacity-50 ${admin ? "bg-indigo-500 text-white" : "bg-primary text-primary-foreground"}`}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div
              className={`grid flex-1 place-items-center p-8 text-center ${admin ? "text-slate-400" : "text-muted-foreground"}`}
            >
              <MessageCircle className="mx-auto mb-3 h-12 w-12 text-primary/50" />
              Select a person to start chatting.
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
