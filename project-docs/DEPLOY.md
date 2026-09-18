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
