"use client";
import { useEffect, useState } from "react";

type AdminRecord = Record<string, unknown>;

export function AdminDataPage({
  resource,
  title,
  description,
}: {
  resource: string;
  title: string;
  description: string;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    void fetch(`/api/v1/admin/data/${resource}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData);
  }, [resource]);
  const rows: AdminRecord[] = data
    ? Object.entries(data)
        .flatMap(([, v]) => (Array.isArray(v) ? v : []))
        .filter((value): value is AdminRecord => typeof value === "object" && value !== null)
    : [];
  const columns = Object.keys(rows[0] ?? {}).slice(0, 6);
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">Admin module</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-500">{description}</p>
      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 text-sm font-semibold text-slate-800">
          Live database records · {rows.length}
        </div>
        {!data ? (
          <div className="h-52 animate-pulse bg-slate-100" />
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider font-semibold text-slate-500">
                <tr>
                  {columns.map((k) => (
                    <th key={k} className="px-5 py-3.5">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr key={i} className="text-slate-700 hover:bg-slate-50/70 transition">
                    {columns.map((k) => (
                      <td key={k} className="max-w-56 truncate px-5 py-4">
                        {typeof row[k] === "object"
                          ? JSON.stringify(row[k])
                          : String(row[k] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-8 text-sm text-slate-500">No records found.</p>
        )}
      </section>
    </div>
  );
}
