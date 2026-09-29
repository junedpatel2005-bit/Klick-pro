"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Smartphone,
  Search,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Users,
  Briefcase,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Filter,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HydratedSmsTemplate } from "@/lib/sms/types";
import { calculateSmsCredits, interpolateVariables } from "@/lib/sms/format";

type AudienceFilter = "ALL" | "CLIENT" | "PROFESSIONAL" | "SYSTEM";

export function AdminSmsTemplateCatalog() {
  const [templates, setTemplates] = useState<HydratedSmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  useEffect(() => {
    async function loadTemplates() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/sms-templates");
        if (!res.ok) throw new Error("Failed to load SMS templates.");
        const data = await res.json();
        setTemplates(data.templates || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading SMS templates");
      } finally {
        setLoading(false);
      }
    }
    void loadTemplates();
  }, []);

  // Compute counts
  const clientCount = useMemo(
    () => templates.filter((t) => t.audience === "CLIENT").length,
    [templates],
  );
  const profCount = useMemo(
    () => templates.filter((t) => t.audience === "PROFESSIONAL").length,
    [templates],
  );
  const systemCount = useMemo(
    () => templates.filter((t) => t.audience === "SYSTEM").length,
    [templates],
  );
  const customizedCount = useMemo(
    () => templates.filter((t) => t.isCustomized).length,
    [templates],
  );

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesAudience = audienceFilter === "ALL" || tpl.audience === audienceFilter;
      const matchesCategory = categoryFilter === "ALL" || tpl.category === categoryFilter;

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        tpl.name.toLowerCase().includes(query) ||
        tpl.description.toLowerCase().includes(query) ||
        tpl.bodyText.toLowerCase().includes(query) ||
        tpl.key.toLowerCase().includes(query);

      return matchesAudience && matchesCategory && matchesSearch;
    });
  }, [templates, audienceFilter, categoryFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading SMS template catalog...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Banner */}
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    SMS Template Studio
                  </h1>
                  <p className="text-sm text-slate-500">
                    Manage critical transaction SMS alerts, DLT template identifiers, and live text
                    copy.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                DLT &amp; Twilio Ready
              </Badge>
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Live GSM-7 Segment Calculator
              </Badge>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total SMS Templates
                </span>
                <MessageSquare className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{templates.length}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Client Alerts
                </span>
                <Users className="h-4 w-4 text-sky-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{clientCount}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Professional Leads
                </span>
                <Briefcase className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{profCount}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Customized Overrides
                </span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{customizedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters and Search Bar */}
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by template name, text copy, or key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Audience Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 md:border-0 md:pt-0">
            {(
              [
                { id: "ALL", label: `All (${templates.length})` },
                { id: "CLIENT", label: `Client (${clientCount})` },
                { id: "PROFESSIONAL", label: `Pro (${profCount})` },
                { id: "SYSTEM", label: `System (${systemCount})` },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setAudienceFilter(filter.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  audienceFilter === filter.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Results grid */}
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <Smartphone className="h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">No SMS templates found</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your search criteria or clearing active filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setAudienceFilter("ALL");
                setCategoryFilter("ALL");
              }}
            >
              Reset filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((tpl) => {
              const sampleText = interpolateVariables(tpl.bodyText, tpl.sampleData);
              const credits = calculateSmsCredits(sampleText);

              return (
                <div
                  key={tpl.key}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
                >
                  <div>
                    {/* Header: Audience badge & status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            tpl.audience === "CLIENT"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : tpl.audience === "PROFESSIONAL"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {tpl.audience}
                        </span>

                        <span className="text-xs font-medium text-slate-400">• {tpl.category}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {tpl.isCustomized ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
                            Customized
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">
                            Default
                          </span>
                        )}
                        <span
                          className={`h-2 w-2 rounded-full ${
                            tpl.isActive ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          title={tpl.isActive ? "Active" : "Inactive"}
                        />
                      </div>
                    </div>

                    {/* Template title & description */}
                    <div className="mt-3.5">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {tpl.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>

                    {/* SMS Bubble Preview */}
                    <div className="mt-4 rounded-xl bg-slate-100 p-3.5 border border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                        <span>SENDER: {tpl.senderId || "KLKPRO"}</span>
                        <span>SMS PREVIEW</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-sans line-clamp-4 select-none">
                        {sampleText}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom / Stats & Action */}
                  <div className="mt-5 border-t border-slate-100 pt-3.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <span className="font-mono text-[11px]">
                        {credits.charCount} chars • {credits.segments}{" "}
                        {credits.segments === 1 ? "credit" : "credits"}
                      </span>
                      {tpl.dltTemplateId ? (
                        <span
                          className="font-mono text-[11px] text-slate-400 truncate max-w-[120px]"
                          title={`DLT ID: ${tpl.dltTemplateId}`}
                        >
                          DLT: {tpl.dltTemplateId}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Header: {tpl.senderId || "KLKPRO"}
                        </span>
                      )}
                    </div>

                    <Link href={`/admin/sms-templates/${tpl.key}`} className="w-full block">
                      <Button
                        variant="outline"
                        className="w-full justify-between text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:border-indigo-300 group/btn"
                      >
                        <span>Edit Template &amp; Test</span>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover/btn:translate-x-0.5 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
