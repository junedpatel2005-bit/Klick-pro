"use client";

import { ExternalLink } from "lucide-react";

export function WebsitePagePreview({ url, title }: { url: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1020]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{title} — original website page</p>
          <p className="text-xs text-slate-400">Full page, using the same public UI and CSS.</p>
        </div>
        <a
          href={url}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open page
        </a>
      </div>
      <iframe
        className="h-[calc(100vh-220px)] min-h-[760px] w-full bg-white"
        src={url}
        title={`${title} live website preview`}
      />
    </div>
  );
}
