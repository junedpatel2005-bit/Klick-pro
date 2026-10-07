> **OBSOLETE (2026-09-19).** This is a Vercel deployment guide. The app cannot run on a
> request-scoped serverless runtime: `server.mjs` is a long-lived process with Socket.IO
> attached. The `@vercel/functions` dependency and `.vercelignore` have been removed.
> For the current position see `docs/08-operations/aws-target.md`.

# Deploying to Vercel

This is a Next.js App Router application. Vercel detects Next.js automatically.

## Local verification

```bash
npm install
npm run lint
npm run build
```

## Deploy

Import the repository in the Vercel dashboard and retain the detected **Next.js** framework preset, or deploy with the CLI:

```bash
npx vercel --prod
```

The production commands are `npm run build` and `npm start`. No Vite, Cloudflare Worker, or TanStack Start adapter is required.
