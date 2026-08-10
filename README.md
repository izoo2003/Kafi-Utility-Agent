# Kafi Utility Agent (Facility Ops Agent)

Single-site facility operations dashboard and Gemini chat assistant. One Next.js app replaces scattered spreadsheets for kitchen inventory, IT equipment, generator maintenance/fuel, solar specs/monitoring, and utility accounts.

**Stack:** Next.js (App Router) · Supabase (Postgres, Auth, Storage) · Tailwind + shadcn/ui · Google Gemini (tool calling + vision)

## Features

- **Dashboard CRUD** for all domains (solar supports PDF/Word/image uploads)
- **Chat agent** — read/write via the same typed data layer (writes require Confirm)
- **Photo analysis** — attach multiple images in chat; Gemini extracts specs/logs and proposes writes
- **Alerts** — low stock, warranty expiry, generator service due, solar alert flags
- **Email digests** — Vercel cron + Resend (optional), with 24h dedupe
- **Exports** — CSV download and print-to-PDF per domain
- **Dual Gemini API keys** — tries all fallback models on key 1, then rotates to key 2 on exhaustion

## Domains

| Domain | What’s tracked |
|--------|----------------|
| Kitchen inventory | Stock, reorder levels |
| IT equipment | Assets, status, warranties |
| Generator | Maintenance schedule + fuel log |
| Solar | Specs, monitoring logs, file uploads |
| Utilities | Internet / electricity / gas / water accounts (no passwords) |

## Project layout

```
app/                 # Pages + API routes
components/          # Dashboard + chat UI
lib/
  supabase/          # Typed queries
  agent/             # Gemini tools, run loop, prompts
  validations/       # Zod schemas
  notifications/     # Alert digests
supabase/migrations/ # Schema + RLS
```

The chat agent never runs raw SQL — it only calls the same typed functions the dashboard uses.

## Local setup

1. **Clone & install**
   ```bash
   git clone https://github.com/izoo2003/Kafi-Utility-Agent.git
   cd Kafi-Utility-Agent
   npm install
   ```

2. **Environment**  
   Copy `.env.example` → `.env` and fill values (Supabase, Gemini, optional Resend/cron).

3. **Database**  
   Run SQL in `supabase/migrations/` in the Supabase SQL Editor (foundation + `alert_notifications`).

4. **Admin user** (username login → synthetic email)
   ```bash
   node scripts/create-admin-user.mjs yourusername 'your-password'
   ```

5. **Dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Deploy (Vercel)

No separate backend host is required — API routes ship with the Next.js app. Supabase stays as the managed DB/auth/storage.

1. Import this repo in [Vercel](https://vercel.com).
2. Add the same env vars as `.env` (never commit `.env`).
3. Set `APP_BASE_URL` to your Vercel URL.
4. Add the Vercel domain to Supabase Auth redirect URLs.
5. Deploy. Cron hits `/api/cron/alerts` daily (see `vercel.json`).

## Environment variables (summary)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` / keys | Supabase client + server |
| `SUPABASE_SECRET_KEY` | Service role (cron, admin scripts) |
| `GEMINI_API_KEY` | Primary chat key |
| `GEMINI_API_KEY_2` | Secondary key after primary models are exhausted |
| `CRON_SECRET` | Protects `/api/cron/alerts` |
| `ALERT_EMAIL_TO` / `RESEND_API_KEY` | Alert email digests |
| `APP_BASE_URL` | Links in emails / reports |

See `.env.example` for the full list.

## License

Private / unlicensed unless otherwise stated. Keep API keys and `.env` out of git.
