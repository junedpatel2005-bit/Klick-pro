"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type FaqItem = {
  id?: number;
  question: string;
  answer: string;
  displayOrder: number;
  status?: string;
  category?: string | null;
};

type ContactRequestItem = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

export default function AdminSupportPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequestItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () =>
    void fetch("/api/v1/admin/data/support", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setFaqs(data.faqs ?? []);
        setContactRequests(data.contactRequests ?? []);
      });

  useEffect(() => {
    load();
  }, []);

  async function addFaq(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || !answer.trim()) {
      setMessage("Please add both a question and an answer.");
      return;
    }
    setSaving(true);
    const response = await fetch(
      editingId ? `/api/v1/admin/support?id=${editingId}` : "/api/v1/admin/support",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
          category: category.trim() || null,
          displayOrder: faqs.length,
        }),
      },
    );
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error ?? "Unable to save FAQ item.");
      return;
    }
    setFaqs((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? data.faq : item))
        : [...current, data.faq],
    );
    setMessage(editingId ? "FAQ item updated." : "FAQ item added.");
    setQuestion("");
    setAnswer("");
    setCategory("");
    setEditingId(null);
  }

  function startEdit(faq: FaqItem) {
    if (!faq.id) return;
    setEditingId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setCategory(faq.category ?? "");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setCategory("");
  }

  async function removeFaq(id: number) {
    const response = await fetch(`/api/v1/admin/support?id=${id}`, { method: "DELETE" });
    if (!response.ok) return setMessage("Unable to delete FAQ item.");
    setFaqs((current) => current.filter((item) => item.id !== id));
    if (editingId === id) cancelEdit();
    setMessage("FAQ item removed.");
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">Support</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">
        FAQ & contact requests
      </h1>
      <p className="mt-1.5 text-slate-500">
        Manage public FAQs and review incoming messages sent through the contact form.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={(event) => void addFaq(event)}
          className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            {editingId ? (
              <Pencil className="h-5 w-5 text-indigo-600" />
            ) : (
              <Plus className="h-5 w-5 text-indigo-600" />
            )}
            <h2 className="font-semibold text-slate-900">{editingId ? "Edit FAQ" : "Add FAQ"}</h2>
          </div>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Question
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
              placeholder="How do I update my profile?"
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Answer
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={5}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
              placeholder="Write the help answer here..."
            />
          </label>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Category
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
              placeholder="General"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Groups items on the public FAQ page. Leave blank for "General".
            </span>
          </label>

          <div className="mt-5 flex gap-2">
            <Button
              disabled={saving}
              className="flex-1 bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs"
            >
              {saving ? "Saving..." : editingId ? "Save changes" : "Add FAQ item"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={cancelEdit}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </Button>
            )}
          </div>
          {message && (
            <p className="mt-3 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              {message}
            </p>
          )}
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-slate-900">Public FAQ</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {faqs.length} items
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {faqs.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No FAQ entries yet.</p>
            ) : (
              faqs.map((faq) => (
                <article
                  key={faq.id ?? `${faq.question}-${faq.displayOrder}`}
                  className={`rounded-xl border p-4 transition ${
                    editingId === faq.id
                      ? "border-indigo-300 bg-indigo-50/50 ring-2 ring-indigo-100"
                      : "border-slate-200 bg-slate-50/60 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{faq.question}</p>
                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                          {faq.category?.trim() || "General"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{faq.answer}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(faq)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                      aria-label={`Edit FAQ ${faq.question}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => faq.id && void removeFaq(faq.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Delete FAQ ${faq.question}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Contact requests</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {contactRequests.length} total
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {contactRequests.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No contact messages yet.</p>
          ) : (
            contactRequests.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.email}</p>
                  </div>
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2.5 text-sm font-semibold text-slate-800">{item.subject}</p>
                <p className="mt-1.5 text-sm text-slate-600 whitespace-pre-wrap">{item.message}</p>
                <p className="mt-3 text-[11px] font-medium text-slate-400">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
