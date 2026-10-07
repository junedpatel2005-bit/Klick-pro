> **OBSOLETE (archived 2026-09-17).** Earlier AI-generated review doc (2026-09-14). Content was verified against code, corrected and absorbed into the structured knowledge base — see [docs/README.md](../../README.md). Known errors include: React Router origin (actually Lovable TanStack Start), references to test files that no longer exist, and outdated counts. Do not rely on this file.

# React Code Reference

How the frontend is actually built, what conventions to follow when adding to it, and where the
existing patterns will bite you.

## Shape of the codebase

| Measure                                     | Count                                    |
| ------------------------------------------- | ---------------------------------------- |
| `.tsx` files across `app/` and `src/`       | 210                                      |
| Files marked `"use client"`                 | 89                                       |
| Feature components (`src/components/*.tsx`) | 48                                       |
| shadcn/ui primitives (`src/components/ui/`) | 46                                       |
| Screen components (`src/routes/`)           | ~40 files, 13,003 lines                  |
| Largest single component                    | `src/routes/job.$jobId.tsx`, 1,797 lines |
| `useState` calls                            | 465                                      |
| `useEffect` calls                           | 146                                      |
| `fetch(` calls in components                | 156                                      |
| `useMemo` / `useCallback`                   | 91 / 34                                  |

## The three component layers

### 1. Server page — `app/**/page.tsx`

Thin. Reads the session, decides on redirects, fetches anything that must come from the server, and
hands off. Typically 10–30 lines.

```tsx
// app/job/[jobId]/page.tsx
export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const token = (await cookies()).get(sessionCookie)?.value;
  let viewerRole: "CLIENT" | "PROFESSIONAL" | null = null;

  if (token) {
    try {
      const session = await verifySession(token);
      if (session.role === "PROFESSIONAL") redirect(`/professional/job/${jobId}`);
      if (session.role === "CLIENT") viewerRole = "CLIENT";
    } catch {
      // Invalid session; treat as public viewer
    }
  }

  return <JobDetails initialViewerRole={viewerRole} />;
}
```

Two Next.js 16 details visible here: `params` is a **Promise** and must be awaited, and so is
`cookies()`. Both are async in this version.

Note what the server page does _not_ do: it passes a role, not data. `JobDetails` fetches everything
it needs from the browser after mount.

### 2. Screen component — `src/routes/**`

The real page. Always `"use client"`. Owns all state, all data fetching, and all user interaction.
These are large — five files exceed 600 lines.

Naming still follows the old React Router flat-route convention:

| File                                     | Serves         |
| ---------------------------------------- | -------------- |
| `src/routes/index.tsx`                   | `/`            |
| `src/routes/job.$jobId.tsx`              | `/job/[jobId]` |
| `src/routes/professional/pro.$proId.tsx` | `/pro/[proId]` |
| `src/routes/client/post-job.tsx`         | `/post-job`    |

The `$param` in the filename is inert — it names nothing. Route params arrive as props from the
server page, or are read with `useParams()`.

### 3. Shared components — `src/components/**`

Feature components (`JobCard`, `MessagesWorkspace`, `ProCard`, the map components) and the shadcn
primitives in `src/components/ui/`.

`components.json` is configured with **`"rsc": false`**, so the shadcn CLI generates client
components. Any primitive you add will carry `"use client"`.

## State and data fetching

There is no data-fetching library in use. The pattern throughout is `useState` + `useEffect` +
`fetch`:

```tsx
const [jobs, setJobs] = useState<Job[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  let cancelled = false;
  fetch("/api/client/jobs")
    .then((res) => res.json())
    .then((body) => {
      if (!cancelled) setJobs(body.jobs ?? []);
    })
    .finally(() => setLoading(false));
  return () => {
    cancelled = true;
  };
}, []);
```

### What is installed but unused

| Package                 | Import count | Note                                                                      |
| ----------------------- | ------------ | ------------------------------------------------------------------------- |
| `@tanstack/react-query` | **0**        | Installed, never imported. No client, no provider.                        |
| `react-hook-form`       | **1**        | Only `src/components/ui/form.tsx`, the shadcn wrapper. No screen uses it. |
| `@hookform/resolvers`   | 0            | Follows from the above.                                                   |

Every form in the application is built from manual `useState` handlers with manual validation.
`zod` is used heavily — but on the server, inside route handlers, not in the browser.

If you are adding a screen, you have a choice to make deliberately: follow the existing manual
pattern for consistency, or start using the libraries that are already paid for. Do not do half of
each in one file.

### No global store

There is no Redux, Zustand, or Jotai. React Context appears in exactly seven files, and five of
those are shadcn primitives managing their own internals:

| Context                                                               | Purpose                                       |
| --------------------------------------------------------------------- | --------------------------------------------- |
| `src/components/GoogleMapsProvider.tsx`                               | Loads the Maps JS SDK once for the whole tree |
| `src/components/PortalShell.tsx`                                      | `usePortalTitle()` — page title only          |
| `ui/carousel`, `ui/chart`, `ui/form`, `ui/sidebar`, `ui/toggle-group` | Primitive internals                           |

Cross-screen state is not shared. Each screen re-fetches what it needs on mount. Session identity is
re-fetched from `/api/auth/me` wherever it is needed rather than held in a provider.

### Providers

The root provider tree is short — see [`src/components/providers.tsx`](../src/components/providers.tsx):

```tsx
<GoogleMapsProvider>
  {children}
  <RealtimeNotifications />
  <Toaster position="top-right" ... />
</GoogleMapsProvider>
```

Mounted for every page including marketing pages, which means the Maps provider and the Socket.IO
notification listener initialise on the public site too.

## Forms

The convention is controlled inputs with local state and server-side validation only:

- Each field gets its own `useState`.
- Submission `POST`s JSON to a route handler.
- The handler validates with zod and returns `{ error: "..." }` on failure.
- The screen renders that message, usually via a `sonner` toast or inline text.

This means **client-side validation is largely absent** — a user finds out a field is wrong after a
round trip. `input-otp` is used for the OTP screens and `react-day-picker` for dates.

## UI and styling

- **Tailwind CSS 4** via `@tailwindcss/postcss`. The entry point is
  [`src/styles.css`](../src/styles.css), which uses the v4 `@import "tailwindcss" source(none)` form
  with explicit `@source "../src"` and `@source "../app"` directives. There is no `tailwind.config.js`
  — v4 configures through CSS.
- **shadcn/ui**, `new-york` style, `slate` base colour, CSS variables enabled.
- **lucide-react** for icons, **sonner** for toasts, **vaul** for drawers, **cmdk** for the command
  palette.
- **recharts** for the reports and earnings charts.
- Variants are handled with `class-variance-authority`; `cn()` in `src/lib/utils.ts` merges classes
  through `tailwind-merge`.

Custom CSS in `src/styles.css` is limited to CKEditor overrides for the CMS admin.

## Realtime in the browser

Two client components hold Socket.IO connections:

| Component               | Connects                     | Listens for                                                                                            |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `RealtimeNotifications` | every page (via `Providers`) | `notification:new`, `message:new`                                                                      |
| `AdminRealtime`         | admin console                | `admin:notification`, `admin:overview-update`, `admin:verifications-update`, `admin:operations-update` |

Connection is cookie-authenticated — the client passes no token, the server reads `servio_session`
from the handshake headers. The path is `/api/realtime`.

Incoming notifications are rendered as `sonner` toasts with a contextual action label derived from
the notification `type` and `href`. A `useRef<Set<string>>` de-duplicates repeats.

Note that realtime events carry **signals, not data** — `project:updated` tells a screen something
changed, and the screen re-fetches. There is no cache to patch.

## Maps and location

Four map components wrap `@react-google-maps/api`:
`ProfessionalDiscoveryMap`, `ProfessionalJobsMap`, `JobsPreviewMap`, `ProfessionalsPreviewMap`, plus
`AddressMapPicker` and `GoogleAddressMap` for input.

All of them consume coordinates the server has already obfuscated — see `createDisplayPoint()` in
[`src/lib/geo.ts`](../src/lib/geo.ts), which deterministically shifts a professional's point
1,200–2,000 m on a per-user bearing. **Never plot a raw `professionalLatitude` / `professionalLongitude`
in a client component.** Those fields must not leave the server.

## Custom hooks

Only three, in `src/hooks/`:

| Hook                     | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `use-mobile.tsx`         | Viewport breakpoint match                               |
| `use-database-status.ts` | Polls `/api/admin/database-status` for the admin banner |
| `use-row-selection.ts`   | Multi-select state for admin tables                     |

Data fetching is not abstracted into hooks. Each screen inlines its own `useEffect` + `fetch`.

## Conventions to follow

1. **Keep `app/**/page.tsx` thin.** Session check, redirect, render. Put logic in `src/routes/`.
2. **Await `params` and `cookies()`.** Both are Promises in Next.js 16.
3. **`"use client"` goes on the screen component**, not the page wrapper, unless the page genuinely
   needs browser APIs.
4. **Import through `@/`**, never with relative paths that climb out of a directory.
5. **Validate on the server.** Even if you add client-side validation, the route handler must
   validate independently — the API is reachable directly.
6. **Give every effect a cleanup** when it sets state after an await. Several existing effects do
   not, and ESLint currently reports 6 `react-hooks` warnings.
7. **Do not plot raw coordinates.** Use the obfuscated display point.

## Known frontend weaknesses

| Issue                                | Detail                                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Screen components are very large     | `job.$jobId.tsx` at 1,797 lines mixes fetching, state, layout and business rules. Hard to test, hard to review.                     |
| Waterfall fetching                   | Server pages pass no data. Every screen fetches after mount, so the first paint is a skeleton even for data the server already had. |
| No request de-duplication or caching | Navigating away and back re-fetches everything. React Query is installed and would solve this.                                      |
| No client-side validation            | Users discover errors after a round trip. `react-hook-form` + `zod` are both available.                                             |
| 6 ESLint `react-hooks` warnings      | Tracked as CODE-001 in `project-docs/CURRENT_PROJECT_STATUS.md`, unresolved.                                                        |
| Providers load everywhere            | Google Maps SDK and the Socket.IO listener mount on public marketing pages that need neither.                                       |
