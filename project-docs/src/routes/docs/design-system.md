# DESIGN SYSTEM & FRONTEND AUDIT

**Derived from:** `skill-shine-gateway-main` (Lovable export, TanStack Start)
**Date:** 09 August 2026

This document codifies the design language already present in the uploaded prototype so it survives the port to production. Tokens below are extracted verbatim from `src/styles.css` — they are not proposals.

---

## 1. WHAT THE PROTOTYPE ACTUALLY IS

| Aspect        | Reality                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Framework     | **TanStack Start** v1.167 + TanStack Router — _not_ Next.js                                                   |
| React         | 19.2                                                                                                          |
| Styling       | Tailwind **v4** (CSS-first `@theme`, no `tailwind.config.js`)                                                 |
| Components    | shadcn/ui — 49 components, Radix primitives                                                                   |
| Forms         | react-hook-form + Zod + `@hookform/resolvers`                                                                 |
| Data          | TanStack Query (installed, unused — all data is mock)                                                         |
| Charts        | Recharts                                                                                                      |
| Icons         | lucide-react                                                                                                  |
| Deploy config | **Both** `wrangler.jsonc` (Cloudflare Workers) and `vercel.json` (static SPA rewrite) — contradictory, see §7 |
| Backend       | None. `src/lib/mock-data.ts` only.                                                                            |

**Assessment:** the visual layer is genuinely good and worth keeping. The routing and data layers are throwaway.

---

## 2. COLOUR TOKENS

All colours are **OKLCH**. Keep it that way — OKLCH gives perceptually uniform lightness, which is why the hover and tint variants look consistent across hues.

### Semantic roles

| Token                  | Light value              | Role — **do not repurpose**                                    |
| ---------------------- | ------------------------ | -------------------------------------------------------------- |
| `--primary`            | `oklch(0.42 0.17 263)`   | Deep blue. Trust, brand, links, focus rings                    |
| `--cta`                | `oklch(0.72 0.19 51)`    | Orange. **Primary action only** — Post Job, Submit Quote, Hire |
| `--success`            | `oklch(0.66 0.17 150)`   | Green. **Verification and completion only**                    |
| `--warning`            | `oklch(0.8 0.17 80)`     | Amber. Pending states, star ratings                            |
| `--destructive`        | `oklch(0.62 0.23 27)`    | Red. Destructive actions, rejections, disputes                 |
| `--ink`                | `oklch(0.27 0.10 263)`   | Deep blue surfaces, dark sections                              |
| `--background`         | `oklch(0.985 0.003 247)` | Soft grey page background                                      |
| `--surface`            | `oklch(1 0 0)`           | White cards on grey                                            |
| `--muted-foreground`   | `oklch(0.5 0.03 257)`    | Secondary text                                                 |
| `--border` / `--input` | `oklch(0.92 0.01 255)`   | Hairlines                                                      |

**The blue/orange split is the core decision of this system and it maps cleanly onto the domain:** blue carries trust (verification, identity, platform), orange carries action (post, quote, hire, pay). Never use orange for a verified badge or blue for a submit button — the prototype is disciplined about this and the production build must stay disciplined.

**Green means verified.** In `ProCard.tsx` the verification tick is `bg-success` ringed against the card. Given that verification badges are the platform's central trust mechanism, green must not leak into generic success toasts that aren't about verification.

### Dark mode

Fully defined in `.dark`. Primary lightens to `0.6` for contrast on dark surfaces. **Keep dark mode** — professionals using the app on-site in variable light are a real use case, and the tokens already exist so the cost is only in testing.

---

## 3. TYPOGRAPHY

```css
--font-sans: "Inter", "Open Sans", ui-sans-serif, system-ui, sans-serif;
--font-display: "Poppins", "Inter", ui-sans-serif, sans-serif;
```

- **Body:** Inter, antialiased
- **Headings h1–h5:** Poppins, `letter-spacing: -0.02em`
- Prices and key numerals use `font-display` at `text-2xl font-bold` — carry this into Flutter

**Flutter equivalent:** `google_fonts` package, `Inter` for `bodyText`, `Poppins` for `displayText`, with the same negative tracking on headings. Do not substitute Roboto.

---

## 4. SHAPE, ELEVATION, MOTION

```css
--radius: 0.875rem; /* 14px base — noticeably rounder than shadcn default */
```

Scale: `sm` 10px · `md` 12px · `lg` 14px · `xl` 18px · `2xl` 22px. Cards use `rounded-2xl`, avatars `rounded-xl`.

Three shadow levels, all blue-tinted (`rgb(15 23 42 / …)`) rather than neutral black — this is why the UI feels cohesive rather than flat:

| Token               | Use                 |
| ------------------- | ------------------- |
| `--shadow-soft`     | Resting cards       |
| `--shadow-card`     | Raised panels       |
| `--shadow-elevated` | Hover state, modals |

**Signature interaction** (`ProCard`): `hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated`. Replicate on every card surface.

### Gradient utilities

`.gradient-hero` · `.gradient-primary` · `.gradient-cta` · `.grid-bg` (48px grid with radial mask). These carry the marketing pages. Keep them for marketing; avoid inside the authenticated app, where flat surfaces read as more trustworthy.

---

## 5. COMPONENT INVENTORY

**49 shadcn/ui primitives present** — accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip, aspect-ratio.

These transfer to Next.js **unchanged** — shadcn is plain React over Radix with no framework coupling.

**Domain components already built:** `ProCard`, `Logo`, `SiteHeader`, `SiteFooter`, `AppShell`, `AuthLayout`.

**`input-otp` is already installed** — matches the OTP requirement in the SRS exactly.

### Domain components still needed

`JobCard` · `QuoteCard` · `MilestoneTracker` · `VerificationBadgeRow` · `MapView` (Google Maps) · `WorkProofGallery` · `ChatThread` · `PaymentBreakdown` · `StripeOnboardingBanner` · `DisputePanel` · `ReviewCard` · `EarningsSummary`

---

## 6. ROUTE AUDIT — 21 built, ~24 missing

### Present and reusable

| Route                                                                            | Maps to                      |
| -------------------------------------------------------------------------------- | ---------------------------- |
| `index`                                                                          | Home (WEB-01)                |
| `how-it-works`, `for-clients`, `for-professionals`, `services`, `pricing`, `faq` | WEB-03…08                    |
| `login`, `signup`, `forgot-password`, `verify`                                   | AUT module                   |
| `discover`                                                                       | CDS — professional discovery |
| `post-job`, `job.$jobId`                                                         | JOB module                   |
| `pro.$proId`                                                                     | Professional public profile  |
| `project.$projectId`                                                             | Work tracking                |
| `messages`                                                                       | Chat                         |
| `notifications`                                                                  | Notification inbox           |
| `dashboard`, `earnings`, `verification`, `admin`                                 | Portal shells                |

### Missing — must be built

**Public:** About Us · Contact Us · **Privacy Policy** · **Terms & Conditions** _(the last two block launch)_

**Client:** profile setup/edit · saved locations · quote comparison · shortlist · milestone funding & checkout · payment method · invoices · review submission · dispute raise

**Professional:** profile setup wizard · portfolio editor · category & skill selection · service-area map editor · **Stripe Connect onboarding** · quote submission · quote revision · saved jobs · milestone submission · work-proof upload · payout history · review response

**Admin:** the single `admin` route is a shell. Needs verification queue, document reviewer, user management, dispute queue, category management, config, audit log — seven distinct screens with role-gated access.

**Cross-cutting:** map view (Google Maps), onboarding gates, empty/loading/error states.

**Roughly 45 screens total on web, plus the Flutter equivalents.**

---

## 7. ISSUES TO FIX ON PORT

1. **Contradictory deploy configs.** `wrangler.jsonc` targets Cloudflare Workers; `vercel.json` is a static SPA rewrite. Neither matches the decided architecture. Both go.

2. **`vercel.json` rewrites everything to `index.html`** — that's a client-rendered SPA. Your marketing pages need server rendering for SEO (SRS-WEB-05). Next.js App Router fixes this by default.

3. **Mock data is US-centric.** San Francisco, Brooklyn, Austin, Los Angeles; `$` implying USD. Launch is Canada — seed data must be Toronto, Vancouver, Calgary, Montreal with CAD.

4. **Mock categories contradict the launch scope.** Twelve categories including Plumbing, Cleaning, Moving, Wellness. Launch is **IT only**, two levels: Development → Frontend/Backend/Mobile, Data → Analytics/ML/Engineering. Keep the 12-category _layout_ — you'll grow into it — but seed only IT.

5. **`ProCard` shows `pro.location` as "San Francisco, CA" and a precise distance.** Per SRS-PRI-02 the public form is city-level plus distance: _"Toronto · 12km"_. The component is already close; just ensure the API never sends more than city.

6. **`avatars()` points at `i.pravatar.cc`** — an external placeholder service. Replace with Supabase Storage URLs before any real deployment.

7. **No auth, no API layer, no route guards.** Every route renders regardless of state.

---

## 8. FLUTTER PARITY

Port the tokens to a Dart theme file rather than re-picking colours:

```dart
// lib/core/theme/tokens.dart
const primary   = Color(0xFF2E4CA6);  // oklch(0.42 0.17 263)
const cta       = Color(0xFFE8863A);  // oklch(0.72 0.19 51)
const success   = Color(0xFF34A56F);  // oklch(0.66 0.17 150)
const warning   = Color(0xFFE0B33C);  // oklch(0.8 0.17 80)
const destructive = Color(0xFFDC3B2F);// oklch(0.62 0.23 27)
const background  = Color(0xFFFAFAFB);
const surface     = Color(0xFFFFFFFF);
const borderColor = Color(0xFFE4E7EC);
const radius = 14.0;
```

_(sRGB conversions — verify against the OKLCH source on a wide-gamut display before locking.)_

Same rule set applies: orange for primary actions, green for verification, 14px radius, Poppins headings, Inter body.

---

## 9. RECOMMENDATION

**Keep:** the token system, all 49 shadcn components, the six domain components, `AppShell` and `AuthLayout` structure, and the marketing page compositions. That is real, finished work.

**Discard:** TanStack Router wiring, `mock-data.ts`, `server.ts`, both deploy configs.

The visual layer transfers at roughly 1:1 cost. The routing layer is a rewrite regardless of which framework you land on — see the framework decision in the accompanying notes.
