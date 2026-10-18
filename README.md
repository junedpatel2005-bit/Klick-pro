# Klick Pro

**Klick Pro** is a modern, high-performance marketplace platform connecting verified service professionals with clients. Built with **Next.js 16 (App Router)**, **React 19**, a custom **Node.js + Socket.IO** real-time server, **PostgreSQL**, and **Prisma ORM**.

---

## Tech Stack & Architecture

- **Frontend & App Framework**: [Next.js 16](https://nextjs.org/) (App Router & Server Actions) with [React 19](https://react.dev/)
- **Real-Time Engine**: Custom HTTP & [Socket.IO](https://socket.io/) server (`server.mjs`) for live messaging, instant proposal alerts, and job updates
- **Database & ORM**: [PostgreSQL 16+](https://www.postgresql.org/) managed via [Prisma ORM 7](https://www.prisma.io/) (`@prisma/client`, `@prisma/adapter-pg`)
- **Styling & UI**: [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), and [Lucide Icons](https://lucide.dev/)
- **Payments & Escrow**: [Razorpay](https://razorpay.com/), Razorpay Route (Split Payments), and RazorpayX (Automated Payouts via UPI & IMPS)
- **Identity & Background Verification**: AuthBridge (Aadhaar / PAN verification), SpringVerify (Police & Criminal Record Check), and Persona
- **Mapping & Geolocation**: Google Maps JavaScript API, Places API, and Server Geocoding API
- **State Management & Forms**: TanStack React Query, React Hook Form, and Zod validation

---

## Requirements

- **Node.js**: `22.x` (pinned in `package.json` `engines` and `.nvmrc`)
- **npm**: `10.x` or higher
- **PostgreSQL**: `16` or newer (installed natively or via Docker)

---

## Local Setup

### 1. Clone the repository and enter the directory

```bash
git clone <repository-url>
cd Klick-pro-main
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Create the environment file

On Windows (PowerShell / Command Prompt):

```bash
copy .env.example .env
```

On macOS / Linux:

```bash
cp .env.example .env
```

### 4. Configure `.env`

Edit `.env` and set the core configuration values:

```dotenv
DATABASE_URL="postgresql://klickpro:YOUR_PASSWORD@localhost:5432/klickpro_dev"
DIRECT_URL="postgresql://klickpro:YOUR_PASSWORD@localhost:5432/klickpro_dev"
SHADOW_DATABASE_URL="postgresql://klickpro:YOUR_PASSWORD@localhost:5432/klickpro_shadow"
APP_URL="http://localhost:3000"
REALTIME_ALLOWED_ORIGIN="http://localhost:3000"
AUTH_SECRET="replace-with-a-long-random-secret"
FILE_STORAGE_PROVIDER="local"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-browser-maps-key"
GOOGLE_MAPS_SERVER_KEY="your-server-geocoding-key"
```

> Keep `.env` secure and private. Never commit database passwords, API keys, or auth secrets.

### 5. Local PostgreSQL Database Setup

PostgreSQL can be installed locally (EnterpriseDB on Windows, Homebrew on macOS, or APT on Ubuntu).

Create the PostgreSQL user and databases:

```bash
# Create the database user (requires CREATEDB privilege for Prisma shadow database)
createuser --pwprompt --createdb klickpro

# Create development, shadow, and test databases
createdb --owner=klickpro klickpro_dev
createdb --owner=klickpro klickpro_shadow
createdb --owner=klickpro klickpro_test
```

### 6. Generate Prisma Client and Run Migrations

```bash
npx prisma generate
npx prisma migrate deploy
```

### 7. (Optional) Seed Demo & Category Data

```bash
# Seed initial demo clients, professionals, and jobs
npm run db:seed

# Seed category and subcategory hierarchy
npm run db:seed-categories
```

### 8. Start Development Server

```bash
npm run dev
```

The application will be accessible at: **`http://localhost:3000`**

---

## Project Scanning & Quality Verification Commands

To perform a complete scan and audit of the project, run the following commands:

| Scan Type                    | Command                             | Description                                                                                                                                       |
| :--------------------------- | :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Full Type Check**          | `npm run typecheck`                 | Scans all `.ts` and `.tsx` files across the entire project using TypeScript (`tsc --noEmit`) to verify zero type mismatches or broken references. |
| **ESLint Static Code Scan**  | `npm run lint`                      | Scans all source files for syntax issues, React 19 hook violations, import errors, and code quality rules (`eslint . --cache`).                   |
| **Single-Command Full Scan** | `npm run typecheck && npm run lint` | **Recommended:** Runs both TypeScript compilation check and ESLint scan sequentially in one command.                                              |
| **Production Build Scan**    | `npm run build`                     | Applies pending database migrations and executes `next build` to verify page rendering, server bundle generation, and static optimization.        |
| **Dependency Security Scan** | `npm audit`                         | Scans installed `node_modules` against the npm security advisory database for known vulnerabilities.                                              |
| **Code Formatting Check**    | `npx prettier --check .`            | Verifies whether all files comply with Prettier formatting rules without modifying them. (Use `npm run format` to auto-fix).                      |
| **Razorpay Sandbox Check**   | `npm run check:razorpay`            | Validates your Razorpay API credentials and sandbox connectivity.                                                                                 |
| **Payment Resilience Check** | `npm run test:resilience`           | Executes resilience and error-handling tests for Razorpay payment workflows.                                                                      |

---

## Database & Migration Rules

This project enforces strict database management policies:

1. **Every Database Change Must Have a Migration File**:
   - Never use `prisma db push` alone in production or shared development.
   - All schema updates in `prisma/schema.prisma` must be followed by a versioned migration:
     ```bash
     npx prisma format
     npx prisma validate
     npx prisma migrate deploy
     npx prisma generate
     ```
2. **Safe & Idempotent DDL**:
   - Use `ALTER TABLE "<TableName>" ADD COLUMN IF NOT EXISTS ...`
   - Use `CREATE TABLE IF NOT EXISTS ...`
   - Use `CREATE INDEX IF NOT EXISTS ...`

---

## Integrations & Services

- **Authentication**: Email/Password with JWT sessions (`jose`), Google OAuth callback at `/api/v1/auth/google`.
- **OTP Verification**: Twilio Verify API for production SMS. In local development, `PHONE_OTP_PROVIDER="development"` uses the default OTP configured in `.env`.
- **Payments (Razorpay)**: Supports direct payments, escrow hold, transfer via Razorpay Route, and automated payouts via RazorpayX.
- **Identity Verification**: AuthBridge and SpringVerify integrations for Aadhaar, PAN, and police background checks.
- **File Storage**: Local file storage (`FILE_STORAGE_PROVIDER="local"`) for local testing, or S3-compatible cloud storage (AWS S3, Cloudflare R2, MinIO) for production.
- **Admin Portal**: Admin management dashboard with user approval, KYC document review, transaction monitoring, and dispute resolution.

---

## Available NPM Scripts

```bash
# Development
npm run dev                  # Start Next.js + Socket.IO development server
npm run dev:webpack          # Start development server using Webpack instead of Turbopack

# Production
npm run build                # Deploy migrations and compile production build
npm start                    # Start production server

# Quality & Scanning
npm run typecheck            # TypeScript compiler scan
npm run lint                 # ESLint code quality scan
npm run format               # Format codebase with Prettier

# Database & Seeding
npm run db:backup            # Create database backup
npm run db:restore           # Restore database from backup
npm run db:seed              # Seed development database
npm run db:seed-categories   # Seed service categories
npm run check:razorpay       # Validate Razorpay sandbox integration
npm run test:resilience      # Test payment resilience
```
