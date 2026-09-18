"use client";
import { useEffect, useState } from "react";
type Conversation = {
  id: string;
  jobTitle: string | null;
  lastMessageAt: string | null;
  messages: { id: string; body: string; createdAt: string }[];
};
export default function Messages() {
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    void fetch("/api/v1/portal/messages")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load conversations");
        setItems((await response.json()) as Conversation[]);
      })
      .catch(() => setError(true));
  }, []);
  return (
    <>
      <h1 className="text-2xl font-semibold">Messages</h1>
      {!items && !error && <div className="mt-6 h-48 animate-pulse rounded-2xl bg-muted" />}
      {error && (
        <p className="mt-6 rounded-xl border border-destructive/30 p-4 text-destructive">
          Messages could not be loaded.
        </p>
      )}
      {items &&
        (items.length ? (
          <ul className="mt-6 divide-y rounded-2xl border border-border bg-card">
            {items.map((conversation) => (
              <li key={conversation.id} className="p-5">
                <p className="font-medium">{conversation.jobTitle ?? "Marketplace conversation"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {conversation.messages[0]?.body ?? "No messages yet."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {conversation.lastMessageAt
                    ? new Date(conversation.lastMessageAt).toLocaleString()
                    : "New conversation"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
            No conversations yet.
          </p>
        ))}
    </>
  );
}
