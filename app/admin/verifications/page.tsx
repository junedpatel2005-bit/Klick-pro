"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type DocumentKey =
  "governmentIdUrl" | "licenseUrl" | "certificationsJson" | "insuranceUrl" | "selfieUrl";
type Verification = {
  userId: number;
  status: "PENDING" | "REJECTED";
  updatedAt: string;
  governmentIdUrl: string | null;
  licenseUrl: string | null;
  certificationsJson: string | null;
  insuranceUrl: string | null;
  selfieUrl: string | null;
  reviews: { documentKey: DocumentKey; status: "APPROVED" | "REJECTED" }[];
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    professionalCategory: string | null;
  };
};
type PersonaVerification = {
  userId: number;
  provider: string;
  providerInquiryId: string;
  providerStatus: string;
  adminStatus: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  user: Verification["user"];
};
const docs = (item: Verification) => [
  { key: "governmentIdUrl" as const, label: "Government ID", value: item.governmentIdUrl },
  { key: "licenseUrl" as const, label: "Professional license", value: item.licenseUrl },
  { key: "certificationsJson" as const, label: "Certificates", value: item.certificationsJson },
  { key: "insuranceUrl" as const, label: "Insurance", value: item.insuranceUrl },
  { key: "selfieUrl" as const, label: "Selfie verification", value: item.selfieUrl },
];

export default function AdminVerificationsPage() {
  const [items, setItems] = useState<Verification[]>([]);
  const [personaItems, setPersonaItems] = useState<PersonaVerification[]>([]);
  const [selected, setSelected] = useState<Verification | null>(null);
  const [document, setDocument] = useState<{ label: string; value: string; owner: string } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [confirmOverall, setConfirmOverall] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [confirmDoc, setConfirmDoc] = useState<{
    key: DocumentKey;
    label: string;
    status: "APPROVED" | "REJECTED";
  } | null>(null);
  const load = () =>
    void fetch("/api/v1/admin/verifications", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.text();
        if (!response.ok) throw new Error(body || "Unable to load verification requests.");
        try {
          return JSON.parse(body) as {
            verifications?: Verification[];
            personaVerifications?: PersonaVerification[];
          };
        } catch {
          throw new Error("Verification service returned an invalid response.");
        }
      })
      .then((data) => {
        setItems(data.verifications ?? []);
        setPersonaItems(data.personaVerifications ?? []);
      })
      .catch(() => {
        setItems([]);
        setMessage("Verification records are temporarily unavailable. Please refresh.");
      });
  useEffect(() => {
    load();
    window.addEventListener("servio:admin-verifications-update", load);
    window.addEventListener("servio:notification", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("servio:admin-verifications-update", load);
      window.removeEventListener("servio:notification", load);
      window.removeEventListener("focus", load);
    };
  }, []);
  const decide = async (status: "APPROVED" | "REJECTED") => {
    if (!selected) return;
    const response = await fetch("/api/v1/admin/verifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: selected.userId, status }),
    });
    if (!response.ok) return setMessage("Could not update verification.");
    setItems((current) => current.filter((item) => item.userId !== selected.userId));
    setSelected(null);
    setMessage(`${selected.user.firstName}'s verification was ${status.toLowerCase()}.`);
  };
  const decidePersona = async (item: PersonaVerification, status: "APPROVED" | "REJECTED") => {
    const response = await fetch("/api/v1/admin/verifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: item.userId,
        providerInquiryId: item.providerInquiryId,
        status,
      }),
    });
    if (!response.ok) return setMessage("Could not update Persona verification.");
    setPersonaItems((current) =>
      current.filter((entry) => entry.providerInquiryId !== item.providerInquiryId),
    );
    setMessage(`${item.user.firstName}'s Persona verification was ${status.toLowerCase()}.`);
  };
  const decideDocument = async (key: DocumentKey, status: "APPROVED" | "REJECTED") => {
    if (!selected) return;
    const response = await fetch("/api/v1/admin/verifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: selected.userId, documentKey: key, status }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage("Could not update document.");
    setSelected((current) =>
      current
        ? {
            ...current,
            reviews: [
              ...current.reviews.filter((review) => review.documentKey !== key),
              data.review,
            ],
          }
        : current,
    );
    setItems((current) =>
      current.map((item) =>
        item.userId === selected.userId
          ? {
              ...item,
              reviews: [
                ...item.reviews.filter((review) => review.documentKey !== key),
                data.review,
              ],
            }
          : item,
      ),
    );
  };
  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Compliance & Safety
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-slate-900 tracking-tight">
            Verification Queue
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Review submitted credentials, ID documentation, insurance policies, and licenses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 border border-amber-200 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            {items.length} Pending Review
          </span>
        </div>
      </div>

      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-2xs">
          {message}
        </p>
      )}

      {/* Manual Verification Cards Grid */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const submitted = docs(item).filter((document) => document.value).length;
          return (
            <button
              key={item.userId}
              onClick={() => setSelected(item)}
              className="group text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 font-extrabold text-base border border-indigo-100 group-hover:scale-105 transition">
                    {item.user.firstName[0]}
                    {item.user.lastName[0]}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">
                      {item.user.firstName} {item.user.lastName}
                    </h2>
                    <p className="text-xs font-medium text-slate-400 truncate max-w-[160px]">
                      {item.user.email}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold border uppercase tracking-wider ${
                    item.status === "PENDING"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {item.status}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {item.user.professionalCategory ?? "General Professional"}
                </span>
              </div>

              {/* Progress Bar for Documents */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-600" />
                    Document Submissions
                  </span>
                  <span className="text-indigo-600 font-bold">{submitted} / 5</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
                    style={{ width: `${(submitted / 5) * 100}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between pt-2 text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
                <span>Inspect application</span>
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>
      {personaItems.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold text-slate-900">
            Persona document verification
          </h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Provider</th>
                  <th className="p-4">Persona Inquiry ID</th>
                  <th className="p-4">Persona Status</th>
                  <th className="p-4">Admin Status</th>
                  <th className="p-4">Submitted At</th>
                  <th className="p-4">Reviewed At</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personaItems.map((item) => (
                  <tr
                    key={item.providerInquiryId}
                    className="text-slate-700 hover:bg-slate-50/70 transition"
                  >
                    <td className="p-4 font-medium text-slate-900">
                      {item.user.firstName} {item.user.lastName}
                    </td>
                    <td className="p-4">{item.provider}</td>
                    <td className="p-4 font-mono text-xs text-slate-600">
                      {item.providerInquiryId}
                    </td>
                    <td className="p-4">{item.providerStatus}</td>
                    <td className="p-4">{item.adminStatus}</td>
                    <td className="p-4 text-slate-500">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}
                    </td>
                    <td className="p-4 text-slate-500">
                      {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : "—"}
                    </td>
                    <td className="p-4">
                      <Button
                        size="sm"
                        onClick={() => void decidePersona(item, "APPROVED")}
                        className="mr-2 bg-emerald-600 text-white hover:bg-emerald-500 shadow-2xs"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void decidePersona(item, "REJECTED")}
                        className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                      >
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-2xs">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
          <p className="mt-4 font-semibold text-slate-900">No verification requests waiting</p>
          <p className="mt-1 text-sm text-slate-500">
            New professional submissions will appear here.
          </p>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">
                  Professional verification
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
                  {selected.user.firstName} {selected.user.lastName}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">{selected.user.email}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {docs(selected).map((item) => (
                <article
                  key={item.label}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  </div>
                  {item.value ? (
                    <div className="mt-3">
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-800 mb-3">
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                        Submitted
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDocument({
                              label: item.label,
                              value: item.value!,
                              owner: `${selected.user.firstName} ${selected.user.lastName}`,
                            })
                          }
                          className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          View document
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            setConfirmDoc({ key: item.key, label: item.label, status: "APPROVED" })
                          }
                          className={
                            selected.reviews.find((review) => review.documentKey === item.key)
                              ?.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200"
                              : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-2xs"
                          }
                        >
                          {selected.reviews.find((review) => review.documentKey === item.key)
                            ?.status === "APPROVED"
                            ? "Approved"
                            : "Approve document"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirmDoc({ key: item.key, label: item.label, status: "REJECTED" })
                          }
                          className={
                            selected.reviews.find((review) => review.documentKey === item.key)
                              ?.status === "REJECTED"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                          }
                        >
                          {selected.reviews.find((review) => review.documentKey === item.key)
                            ?.status === "REJECTED"
                            ? "Rejected"
                            : "Reject document"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">Not submitted</p>
                  )}
                </article>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
              <Button
                variant="outline"
                onClick={() => setConfirmOverall("REJECTED")}
                className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
              >
                Reject
              </Button>
              <Button
                onClick={() => setConfirmOverall("APPROVED")}
                className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Approve verification
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmDoc && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {confirmDoc.status === "APPROVED" ? "Approve document?" : "Reject document?"}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {confirmDoc.status === "APPROVED"
                ? `Mark "${confirmDoc.label}" as approved for ${selected?.user.firstName} ${selected?.user.lastName}.`
                : `Mark "${confirmDoc.label}" as rejected for ${selected?.user.firstName} ${selected?.user.lastName}.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={() => setConfirmDoc(null)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className={
                  confirmDoc.status === "APPROVED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                }
                onClick={() => {
                  const { key, status } = confirmDoc;
                  setConfirmDoc(null);
                  void decideDocument(key, status);
                }}
              >
                {confirmDoc.status === "APPROVED" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmOverall && selected && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {confirmOverall === "APPROVED" ? "Approve verification?" : "Reject verification?"}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {confirmOverall === "APPROVED"
                ? `${selected.user.firstName} ${selected.user.lastName} will be marked as a verified professional.`
                : `${selected.user.firstName} ${selected.user.lastName}'s verification request will be rejected.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={() => setConfirmOverall(null)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className={
                  confirmOverall === "APPROVED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                }
                onClick={() => {
                  const status = confirmOverall;
                  setConfirmOverall(null);
                  void decide(status);
                }}
              >
                {confirmOverall === "APPROVED" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {document && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">
                  Document review
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
                  {document.label}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">Submitted by {document.owner}</p>
              </div>
              <button
                onClick={() => setDocument(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {document.value.startsWith("/") ? (
              document.value.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={document.value}
                  className="mt-6 h-[65vh] w-full rounded-2xl bg-white border border-slate-200"
                  title={document.label}
                />
              ) : (
                <img
                  src={document.value}
                  alt={document.label}
                  className="mt-6 max-h-[65vh] w-full rounded-2xl object-contain bg-slate-50 border border-slate-200"
                />
              )
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <FileText className="h-8 w-8 text-indigo-600" />
                <p className="mt-4 break-all text-sm font-semibold text-slate-900">
                  {document.value}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This older request only stored the file name, so the original image is not
                  available. Please upload the document again from the Professional Verification
                  page.
                </p>
              </div>
            )}
            <Button className="mt-6 w-full" variant="outline" onClick={() => setDocument(null)}>
              Close document
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
