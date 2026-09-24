"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Mail,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HydratedEmailTemplate } from "@/lib/email-templates/types";

type AudienceFilter = "ALL" | "CLIENT" | "PROFESSIONAL" | "SYSTEM";

export function AdminTemplateLibraryCatalog() {
  const [templates, setTemplates] = useState<HydratedEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  useEffect(() => {
    async function loadTemplates() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/email-templates");
        if (!res.ok) throw new Error("Failed to load email templates.");
        const data = await res.json();
        setTemplates(data.templates || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading templates");
      } finally {
        setLoading(false);
      }
    }
    void loadTemplates();
  }, []);

  // Compute counts
  const clientCount = useMemo(() => templates.filter((t) => t.audience === "CLIENT").length, [templates]);
  const profCount = useMemo(() => templates.filter((t) => t.audience === "PROFESSIONAL").length, [templates]);
  const systemCount = useMemo(() => templates.filter((t) => t.audience === "SYSTEM").length, [templates]);
  const customizedCount = useMemo(() => templates.filter((t) => t.isCustomized).length, [templates]);

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
      const matchesAudience =
        audienceFilter === "ALL" || tpl.audience === audienceFilter;
      const matchesCategory =
        categoryFilter === "ALL" || tpl.category === categoryFilter;

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        tpl.name.toLowerCase().includes(query) ||
        tpl.description.toLowerCase().includes(query) ||
        tpl.subject.toLowerCase().includes(query) ||
        tpl.key.toLowerCase().includes(query);

      return matchesAudience && matchesCategory && matchesSearch;
    });
  }, [templates, audienceFilter, categoryFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading email templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <h2 className="text-lg font-semibold">Failed to load templates</h2>
        </div>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Stats Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Email Template Library</h1>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200/80 text-xs">
                {templates.length} Templates
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Select any transactional email template to customize copy, dynamic merge tags, and preview live inboxes.
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-3.5 py-1.5 text-blue-700 shadow-2xs">
            <Users className="h-4 w-4" />
            <span className="text-xs font-semibold">Client Emails: {clientCount}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-violet-200/80 bg-violet-50/70 px-3.5 py-1.5 text-violet-700 shadow-2xs">
            <Briefcase className="h-4 w-4" />
            <span className="text-xs font-semibold">Pro Emails: {profCount}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-1.5 text-emerald-700 shadow-2xs">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-semibold">Customized Overrides: {customizedCount}</span>
          </div>
        </div>
      </div>

      {/* Search & Filtering Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by template name, subject, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-sm bg-slate-50/70 border-slate-200 focus:bg-white h-10 rounded-xl"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audience Filter Tabs */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          {(
            [
              { id: "ALL", label: "All Templates", count: templates.length },
              { id: "CLIENT", label: "Client Emails", count: clientCount },
              { id: "PROFESSIONAL", label: "Professional Emails", count: profCount },
              { id: "SYSTEM", label: "Auth & System", count: systemCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAudienceFilter(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                audienceFilter === tab.id
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                  audienceFilter === tab.id
                    ? "bg-slate-800 text-slate-200"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Clean, Spacious Template Cards */}
      {filteredTemplates.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
          <Mail className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-slate-700">No email templates found</h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search query or audience filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTemplates.map((tpl) => (
            <Link
              key={tpl.key}
              href={`/admin/templates/${tpl.key}`}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md hover:ring-2 hover:ring-indigo-100"
            >
              <div className="space-y-3">
                {/* Card Top Row: Badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {tpl.audience === "CLIENT" ? (
                      <span className="rounded-lg bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                        Client
                      </span>
                    ) : tpl.audience === "PROFESSIONAL" ? (
                      <span className="rounded-lg bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700 border border-violet-200">
                        Professional
                      </span>
                    ) : (
                      <span className="rounded-lg bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                        System / Auth
                      </span>
                    )}

                    <span className="text-xs font-medium text-slate-400">{tpl.category}</span>
                  </div>

                  {tpl.isCustomized ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Customized
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Default</span>
                  )}
                </div>

                {/* Template Name & Description */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {tpl.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>

                {/* Subject Preview Box */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                    Subject Line
                  </div>
                  <div className="text-xs font-medium text-slate-800 line-clamp-1">
                    {tpl.subject}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Sparkles className="h-3 w-3 text-indigo-500" />
                  {tpl.variables?.length ?? 0} merge tags
                </span>

                <span className="inline-flex items-center gap-1 font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                  Edit &amp; Live Preview
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

