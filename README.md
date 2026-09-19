# Servio

Servio is a Next.js application with a custom Node.js/Socket.IO server, PostgreSQL, and Prisma.

## Requirements

- Node.js 22 (pinned in `package.json` `engines` and `.nvmrc`; CI runs 22)
- npm
- PostgreSQL 16 or newer, installed natively (see below)

## Local setup

1. Clone the repository and enter it:

   ```bash
   git clone <repository-url>
   cd klick-pro
   ```

2. Install the exact dependency versions from the lockfile:

   ```bash
   npm ci
   ```

3. Create the environment file:

   ```bash
   copy .env.example .env
   ```

   On macOS/Linux, use `cp .env.example .env` instead.

4. Edit `.env` and set at least these values (see the PostgreSQL section below
   for how to create the databases):

   ```dotenv
   DATABASE_URL="postgresql://servio:PASSWORD@localhost:5432/servio_dev"
   DIRECT_URL="postgresql://servio:PASSWORD@localhost:5432/servio_dev"
   SHADOW_DATABASE_URL="postgresql://servio:PASSWORD@localhost:5432/servio_shadow"
   APP_URL="http://localhost:3000"
   REALTIME_ALLOWED_ORIGIN="http://localhost:3000"
   AUTH_SECRET="replace-with-a-long-random-secret"
   FILE_STORAGE_PROVIDER="local"
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-browser-maps-key"
   GOOGLE_MAPS_SERVER_KEY="your-server-geocoding-key"
   ```

   Keep `.env` private. Do not commit database passwords, API keys, or auth secrets.

5. Generate the Prisma client and apply the database migrations:

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

6. Optionally load development/demo data:

   ```bash
   npm run db:seed
   ```

7. Start the application:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## Local PostgreSQL

PostgreSQL runs natively on the development machine. Install it first:

- **Windows** — the EnterpriseDB installer from postgresql.org. Add its `bin` directory to `PATH` so `psql` and `createdb` are available.
- **macOS** — `brew install postgresql@16 && brew services start postgresql@16`
- **Debian/Ubuntu** — `sudo apt install postgresql-16`

### Create the role and three databases

```bash
# CREATEDB is required: prisma migrate dev creates and drops a shadow database.
createuser --pwprompt --createdb servio

createdb --owner=servio servio_dev      # development data
createdb --owner=servio servio_shadow   # used by prisma migrate dev only
createdb --owner=servio servio_test     # disposable; wiped by the test suite
```

`servio_test` must stay separate from `servio_dev`. The test harness refuses to run when
`TEST_DATABASE_URL` and `DATABASE_URL` point at the same database.

### Before running any Prisma command, check which database you are pointed at

**An exported shell variable overrides `.env`.** This has already caused one incident: an
inherited `DATABASE_URL` beat the intended configuration and a `prisma db push` plus seed ran
against a real local database instead of the throwaway one. `npm run build` also runs
`prisma migrate deploy`, so a build with a stray variable set will migrate whatever it points at.

```bash
echo $DATABASE_URL        # bash / Git Bash — expect empty, or your intended dev database
$env:DATABASE_URL         # PowerShell
```

If it is set and you did not mean it, `unset DATABASE_URL` (bash) or
`Remove-Item Env:DATABASE_URL` (PowerShell) before continuing.

## Useful commands

```bash
npm run lint
npm run typecheck
npm run build
npm start
```

## Optional integrations

Email, Google OAuth, Google Maps, Sentry, Persona, Twilio, Razorpay, and S3-compatible storage are configured through `.env`. Leave them disabled or blank for basic local development. Keep `PHONE_OTP_PROVIDER=development` unless Twilio is configured.

### Google Maps

Enable billing plus the Maps JavaScript API, Places API, and Geocoding API in Google Cloud. Use a browser key for the interactive map and `GOOGLE_MAPS_SERVER_KEY` for `/api/geocode`. Do not commit either key.

### Google login

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`, then add this exact local redirect URI to the Google OAuth client:

```text
http://localhost:3000/api/v1/auth/google
```

For production, add the matching HTTPS callback URL for the deployed domain.

To create the first administrator in a new database, set `ADMIN_BOOTSTRAP_USERNAME` and `ADMIN_BOOTSTRAP_PASSWORD` in `.env` before using the admin bootstrap flow.

## Mobile client

There is no mobile client in this repository. The `flutter_app/` directory referenced by earlier
versions of this README no longer exists. The `/api/v1` namespace remains, so a future client
has a stable surface to target.
