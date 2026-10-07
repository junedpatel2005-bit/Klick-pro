# NEXT.JS PORT GUIDE

**From:** `skill-shine-gateway-main` — Lovable export, TanStack Start + TanStack Router
**To:** Next.js 15 App Router, in `apps/web`

The visual layer transfers near-1:1. The routing and data layers are a rewrite either way, since everything currently runs on `mock-data.ts`.

---

## 1. WHAT MOVES UNCHANGED

| Asset                                         | Action                                              |
| --------------------------------------------- | --------------------------------------------------- |
| `src/styles.css`                              | Copy verbatim, adjust two lines (§3)                |
| `src/components/ui/*` — 49 shadcn components  | Copy verbatim, add `"use client"` where needed (§4) |
| `src/lib/utils.ts` (`cn` helper)              | Copy verbatim                                       |
| `ProCard`, `Logo`, `SiteHeader`, `SiteFooter` | Copy, swap `Link` import                            |
| Marketing page compositions                   | Copy JSX bodies into new `page.tsx` files           |
| `components.json`                             | Copy, update aliases (§2)                           |

**Dependencies that work unchanged:** all `@radix-ui/*`, `lucide-react`, `sonner`, `react-hook-form`, `@hookform/resolvers`, `zod`, `class-variance-authority`, `clsx`, `tailwind-merge`, `date-fns`, `recharts`, `embla-carousel-react`, `input-otp`, `cmdk`, `vaul`, `react-day-picker`, `tw-animate-css`.

**Keep TanStack Query.** It's already a dependency and remains the right tool for client-side mutations, optimistic updates, and cache invalidation in the authenticated portals. Only the _router_ is replaced.

## 2. WHAT GOES

| Remove                                                                           | Why                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------ |
| `@tanstack/react-router`, `react-start`, `router-plugin`                         | Replaced by App Router                           |
| `src/routeTree.gen.ts`, `src/router.tsx`, `src/routes/*`                         | Regenerated as `app/`                            |
| `src/server.ts`, `src/start.ts`                                                  | Next.js owns the server                          |
| `wrangler.jsonc`                                                                 | Cloudflare Workers — not the target              |
| `vercel.json`                                                                    | Rewrites everything to `index.html`, killing SEO |
| `@cloudflare/vite-plugin`, `@lovable.dev/vite-tanstack-config`, `vite.config.ts` | Vite replaced by Next build                      |
| `src/lib/mock-data.ts`                                                           | Replaced by real API — see §7                    |
| `src/lib/error-capture.ts`, `error-page.ts`                                      | Next `error.tsx` / `not-found.tsx`               |

`components.json` aliases become:

```json
{ "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" } }
```

## 3. TAILWIND V4 UNDER NEXT.JS

Tailwind v4 works with Next, but not through the Vite plugin.

```bash
pnpm add tailwindcss @tailwindcss/postcss
```

```js
// postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
```

In `styles.css`, change only the source directive:

```css
@import "tailwindcss";
@source "../"; /* was: source(none) + @source "../src" */
@import "tw-animate-css";
```

**Everything below that line — the entire `@theme inline` block, `:root`, `.dark`, and the gradient utilities — is copied untouched.** There is no `tailwind.config.js` in v4; don't let anyone generate one.

## 4. `"use client"` BOUNDARIES

App Router defaults to Server Components. Any file using hooks, Radix primitives, or event handlers needs the directive.

- **Every file in `components/ui/` that imports a Radix primitive or a React hook** needs `"use client"` at the top. In practice that's most of them — `button.tsx` and `badge.tsx` are among the few that don't.
- Cheapest approach: add it to all 49 during the copy, then remove it where the build proves it unnecessary. Getting this wrong produces cryptic errors; over-applying costs a little bundle size.
- **Keep marketing pages as Server Components.** They're static and need SSR for SEO — that's a large part of why you're moving off the SPA build.

## 5. FONTS

The prototype references Inter and Poppins by family name, which means a render-blocking external request and layout shift. Self-host through `next/font`:

```ts
// app/layout.tsx
import { Inter, Poppins } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
```

Apply `${inter.variable} ${poppins.variable}` on `<html>`, then in `styles.css`:

```css
--font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
--font-display: var(--font-poppins), var(--font-inter), sans-serif;
```

Poppins only needs 600/700 — it's headings-only. Don't ship all nine weights.

## 6. ROUTE STRUCTURE

**Critical:** route groups in parentheses do **not** create URL segments. `(client)/dashboard` and `(professional)/dashboard` both resolve to `/dashboard` and will collide at build time. Client and professional portals need real path segments.

```
apps/web/src/app/
├── (marketing)/                      → SSR, public, indexed
│   ├── layout.tsx                      SiteHeader + SiteFooter
│   ├── page.tsx                        Home
│   ├── about/ how-it-works/ services/
│   ├── for-clients/ for-professionals/
│   ├── pricing/ faq/ contact/
│   └── privacy/ terms/                 ← blocks launch, build early
│
├── (auth)/                           → AuthLayout
│   ├── login/ signup/ verify/
│   └── forgot-password/ reset-password/
│
├── (public-browse)/                  → visitors may view, masked
│   ├── discover/                       professional search + map
│   ├── pro/[proId]/
│   └── jobs/  jobs/[jobId]/
│
├── client/                           → real segment, role-guarded
│   ├── dashboard/
│   ├── jobs/ new/ [jobId]/ [jobId]/quotes/
│   ├── shortlist/ messages/[threadId]/
│   ├── payments/ invoices/ profile/
│
├── pro/                              → real segment, role-guarded
│   ├── dashboard/ feed/ saved/
│   ├── quotes/ quotes/new/[jobId]/
│   ├── work/[jobId]/ earnings/
│   ├── verification/ profile/ onboarding/stripe/
│
├── admin/                            → role + MFA guarded
│   ├── verification/ users/ disputes/
│   ├── categories/ config/ audit/
│
└── api/v1/                           → the contract (ADR-001)
    ├── auth/ profiles/ jobs/ quotes/
    ├── milestones/ payments/ reviews/
    ├── messages/ notifications/ admin/
    └── webhooks/stripe/
```

Guard `client/`, `pro/`, and `admin/` in middleware by decoding the JWT and checking `userType` — and re-check server-side in every handler. Middleware is UX, not security.

## 7. MIGRATION ORDER

Do it in this sequence; each step leaves a working build.

1. **Scaffold** — `create-next-app` into `apps/web`, TypeScript, App Router, no Tailwind (you're bringing v4 yourself).
2. **Tokens** — copy `styles.css`, wire fonts, verify a page renders in your blue/orange palette. Nothing else until this looks right.
3. **Primitives** — copy all 49 `ui/` components, add `"use client"`, get `pnpm build` green with zero pages.
4. **Shell** — port `SiteHeader`, `SiteFooter`, `Logo`, `AppShell`, `AuthLayout` into layouts.
5. **Marketing** — 11 pages as Server Components with the Metadata API. Ship this; it's independently valuable and gets SEO working.
6. **Auth** — screens plus the real `/api/v1/auth/*` handlers. First vertical slice end-to-end.
7. **Everything else** — one milestone at a time, API handler before UI, per ADR-001.

**Do not port `mock-data.ts`.** Replace mock arrays with TanStack Query calls against real endpoints as each module lands. Carrying mock data forward means shipping it by accident.

## 8. FIX WHILE PORTING

| Issue                                                | Fix                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| US mock data (SF, Brooklyn, Austin)                  | Seed Toronto, Vancouver, Calgary, Montreal — CAD                                       |
| 12 categories incl. trades                           | Seed IT only: Development → Frontend/Backend/Mobile, Data → Analytics/ML/Engineering   |
| `i.pravatar.cc` avatars                              | Supabase Storage; add domain to `next.config` `images.remotePatterns`                  |
| `ProCard` shows "San Francisco, CA" + exact distance | City + distance only: "Toronto · 12km" (SRS-PRI-02)                                    |
| `<img>` tags                                         | `next/image` for portfolio and work proof — real bandwidth saving on photo-heavy pages |
| No route guards                                      | Middleware + server-side authorization                                                 |
| No dark-mode toggle                                  | `next-themes`; tokens already exist, don't waste them                                  |

## 9. RESPONSIVE IS NOW LOAD-BEARING

With Flutter deferred, on-site professionals will use phone browsers for months. These three screens must be excellent at 375px, not merely unbroken:

- **Job feed** — one-handed scroll, filters in a `Sheet` not a sidebar
- **Quote submission** — short form, numeric keyboards, drafts that survive a backgrounded tab
- **Work-proof upload** — camera capture, multi-file, visible progress, resume after connection loss

Worth considering a **PWA** (manifest + service worker). You're already building web push for notifications, so installability and offline shell are a small increment — and it gives professionals an app icon before Flutter ships.

## 10. VERSION NOTES

- **React 19** — already on it; Next 15 supports it. No downgrade.
- **Turbopack** for `next dev`; it handles this dependency set fine.
- `react-day-picker@9` works with React 19; if the shadcn `calendar.tsx` errors, it's the wrapper, not the library.
- Keep `zod@3` — v4 changed inference and would ripple through every form.
