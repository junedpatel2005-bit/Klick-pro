# Servio

Servio is a Next.js application with a custom Node.js/Socket.IO server, PostgreSQL, and Prisma.

## Requirements

- Node.js 20.9 or newer
- npm
- PostgreSQL 16 or a hosted PostgreSQL database
- Docker Desktop is optional, but useful for running PostgreSQL locally

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

4. Edit `.env` and set at least these values:

   ```dotenv
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
   DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
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

## Local PostgreSQL with Docker

If PostgreSQL is not already available, start a local container:

```bash
docker run --name servio-postgres -e POSTGRES_DB=servio -e POSTGRES_USER=servio -e POSTGRES_PASSWORD=servio_password -p 5432:5432 -d postgres:16-alpine
```

Then use these connection strings in `.env`:

```dotenv
DATABASE_URL="postgresql://servio:servio_password@localhost:5432/servio"
DIRECT_URL="postgresql://servio:servio_password@localhost:5432/servio"
```

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

## Flutter app

The mobile client is in `flutter_app/`. Install Flutter, then run:

```bash
cd flutter_app
flutter pub get
flutter run
```

Configure the API base URL according to the device or emulator being used; `localhost` from a physical device refers to the device itself, not the development computer.
