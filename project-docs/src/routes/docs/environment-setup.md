# ENVIRONMENT SETUP RUNBOOK

Local development for the Service Marketplace Platform. Follow top to bottom; each section leaves a working state.

---

## 1. PREREQUISITES

| Tool    | Version          | Note                                                         |
| ------- | ---------------- | ------------------------------------------------------------ |
| Node.js | 20 LTS or 22 LTS | Not 21 — odd releases aren't LTS                             |
| pnpm    | 9+               | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker  | latest           | For local Postgres + PostGIS                                 |
| Git     | 2.40+            |                                                              |

---

## 2. ACCOUNTS REQUIRED

Ordered by when you need them. Nothing in M0 requires a paid account.

| Service      | Needed by | Cost          | Notes                                                                            |
| ------------ | --------- | ------------- | -------------------------------------------------------------------------------- |
| GitHub       | M0        | Free          | Actions minutes free on public, 2000/mo private                                  |
| Supabase     | M0        | Free → $25/mo | **Verify PostGIS is enabled** on the project                                     |
| Vercel       | M0        | $20/user/mo   | Hobby prohibits commercial use — Pro from the start                              |
| Google Cloud | M3        | Pay-as-you-go | Maps JS, Places, Geocoding, Distance Matrix. **Set a billing alert immediately** |
| Twilio       | M1        | ~$0.0079/SMS  | Trial only sends to verified numbers — upgrade before real OTP testing           |
| Mailtrap     | M1        | Free          | Dev email capture                                                                |
| SendGrid     | M8        | Free → $20/mo | Production email                                                                 |
| Stripe       | M6        | 2.9% + $0.30  | **Enable Connect in test mode early** — onboarding flows need it                 |
| Sentry       | M8        | Free tier     | Error tracking                                                                   |

---

## 3. LOCAL DATABASE

Use Docker locally rather than pointing at Supabase — migrations against a shared database will collide between two developers.

```yaml
# docker-compose.yml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: marketplace
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: marketplace_dev
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U marketplace"]
      interval: 5s
      retries: 10

volumes:
  pgdata:
```

```bash
docker compose up -d
docker compose exec db psql -U marketplace -d marketplace_dev -c "SELECT PostGIS_Version();"
```

**The `postgis/postgis` image is required.** The plain `postgres` image has no PostGIS and every geo migration will fail with a confusing extension error.

---

## 4. ENVIRONMENT VARIABLES

Create `.env.example` in the repo (committed) and `.env.local` (git-ignored).

```bash
# ─── Database ────────────────────────────────────────────────
DATABASE_URL="postgresql://marketplace:localdev@localhost:5432/marketplace_dev"
DIRECT_URL="postgresql://marketplace:localdev@localhost:5432/marketplace_dev"
# On Supabase, DATABASE_URL uses the pooler (6543) and DIRECT_URL the
# direct port (5432). Prisma migrations require DIRECT_URL.

# ─── App ─────────────────────────────────────────────────────
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api/v1"

# ─── Auth (own JWT — RS256) ──────────────────────────────────
# Generate: openssl genrsa -out private.pem 2048
#           openssl rsa -in private.pem -pubout -out public.pem
JWT_PRIVATE_KEY=""            # base64-encoded PEM
JWT_PUBLIC_KEY=""             # base64-encoded PEM
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="30d"
ARGON2_MEMORY_COST="19456"
GEO_OBFUSCATION_SALT=""       # 32+ random bytes — see warning below

# ─── Google OAuth ────────────────────────────────────────────
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ─── Supabase Storage ────────────────────────────────────────
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""  # server only — NEVER prefix NEXT_PUBLIC_
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""

# ─── Google Maps ─────────────────────────────────────────────
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""   # browser key — restrict by HTTP referrer
GOOGLE_MAPS_SERVER_KEY=""            # server key — restrict by IP

# ─── Twilio ──────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""

# ─── Email (SMTP) ────────────────────────────────────────────
SMTP_HOST="sandbox.smtp.mailtrap.io"
SMTP_PORT="2525"
SMTP_USER=""
SMTP_PASSWORD=""
EMAIL_FROM="noreply@example.ca"

# ─── Web Push (VAPID) ────────────────────────────────────────
# Generate: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:admin@example.ca"

# ─── Stripe (M6) ─────────────────────────────────────────────
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_CONNECT_CLIENT_ID=""

# ─── Jobs ────────────────────────────────────────────────────
CRON_SECRET=""                # guards /api/cron/* against public invocation
```

> **`GEO_OBFUSCATION_SALT` must never change once professionals exist.** Marker offsets are derived deterministically from it. Rotating the salt moves every professional's public map pin, and the delta between old and new positions leaks information about the true location.

> **`SUPABASE_SERVICE_ROLE_KEY` bypasses all row-level security.** Server-side only. If it ever gains a `NEXT_PUBLIC_` prefix it is shipped to every browser and must be rotated immediately.

---

## 5. FIRST RUN

```bash
git clone <repo> && cd <repo>
corepack enable && pnpm install
cp .env.example .env.local          # then fill in the blanks

docker compose up -d
pnpm db:migrate                     # applies schema + PostGIS migration
pnpm db:seed                        # categories, tax rates, fixtures
pnpm --filter web dev               # http://localhost:3000
```

Verify before moving on:

```bash
# PostGIS present and indexed
docker compose exec db psql -U marketplace -d marketplace_dev \
  -c "\di *point*"

# Radius query returns rows
docker compose exec db psql -U marketplace -d marketplace_dev -c \
  "SELECT count(*) FROM professional_profiles p
   WHERE ST_DWithin(p.base_point,
     ST_MakePoint(-79.3832, 43.6532)::geography, 25000);"
```

---

## 6. SEED DATA

The seed must produce data that actually exercises geo matching. Three professionals in one city proves nothing.

| Set             | Content                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Platform config | Single row, 10% commission, CAD, ON default                                                           |
| Tax rates       | All 13 provinces/territories, 2026 rates                                                              |
| Categories      | Development → Frontend, Backend, Mobile · Data → Analytics, ML, Engineering                           |
| Skills          | ~40 IT skills                                                                                         |
| Admin           | One SUPER_ADMIN, one VERIFICATION_REVIEWER                                                            |
| Clients         | 20 across Toronto, Vancouver, Calgary, Montreal, Ottawa                                               |
| Professionals   | 60 — varied radii (5–100km), mixed ONSITE/REMOTE/BOTH, mixed verification states, some with no badges |
| Jobs            | 40 across all statuses, mixed urgency, some remote                                                    |
| Quotes          | 60 across submitted/accepted/rejected                                                                 |
| Reviews         | Enough to exercise the 3-review rating threshold                                                      |

**Deterministic seed** — fix the random seed so both developers get identical data and bug reports are reproducible.

---

## 7. COMMON PROBLEMS

| Symptom                                     | Cause                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `type "geography" does not exist`           | Plain `postgres` image instead of `postgis/postgis`                                    |
| `prisma migrate` hangs on Supabase          | Using pooler URL — migrations need `DIRECT_URL` on port 5432                           |
| Radius queries slow                         | GiST indexes not created; they're in the hand-written migration, not the Prisma schema |
| `Unsupported` field errors in Prisma Client | Expected — geography columns are unreadable by Prisma. Use `GeoRepository`             |
| Twilio 21608                                | Trial account, unverified destination number                                           |
| Maps blank, console 403                     | Key restrictions exclude `localhost:3000`                                              |
| Tailwind classes missing                    | `@source` in `styles.css` not updated for the App Router path                          |

---

## 8. SECRETS

- `.env.local` is git-ignored. Never commit it.
- `.env.example` holds keys with empty values only.
- Share real values through a password manager, not Slack or email.
- Vercel holds production and preview secrets; GitHub Actions holds CI secrets.
- Rotate anything that reaches a log, a screenshot, or a public repo.
