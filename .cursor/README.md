# Facility Ops Agent

Chat agent + dashboard for a single-site facility (kitchen, IT, generator, solar, utilities).

Stack: **Next.js (App Router)** + **Supabase** + **Tailwind/shadcn** + **Gemini tool-calling**.

## Project structure

This is one Next.js app (not a separate frontend/backend repo). Layers map like this:

| Layer | Path | Role |
|-------|------|------|
| **Frontend (UI)** | `app/`, `components/` | Pages, layouts, shadcn UI, dashboard + chat components |
| **Backend (API)** | `app/api/` | HTTP routes per domain + `/api/agent` |
| **Domain logic** | `lib/supabase/`, `lib/validations/`, `lib/agent/` | Typed DB queries, Zod schemas, agent tools |
| **Auth helpers** | `lib/auth/`, `lib/supabase/{client,server,admin,middleware}.ts` | Session clients + route guards |
| **Shared types** | `lib/types/` | Table row / insert / update TypeScript types |
| **Database** | `supabase/migrations/` | Postgres schema, RLS, storage bucket |

```
app/
  login/                         # Auth UI
  dashboard/                     # Frontend shell + domain pages
    kitchen-inventory/
    it-equipment/
    generator/
    solar/
    utilities/
  api/                           # Backend routes (auth required)
    kitchen-inventory/
    it-equipment/
    generator/
    solar/
    utilities/
    agent/
components/
  ui/                            # shadcn primitives
  dashboard/                     # Shared dashboard UI
  chat/                          # Chat UI (Phase 4+)
lib/
  types/database.ts              # DB TypeScript types
  validations/                   # Zod schemas (API + agent)
  supabase/                      # Clients + typed queries per domain
  agent/                         # tools.ts + system-prompt.ts
  auth/                          # requireUser() for API routes
supabase/
  migrations/                    # Source of truth for schema
scripts/
  create-admin-user.mjs          # One-time admin Auth user
```

**Convention:** every domain gets all four layers — typed queries, API route, dashboard page, agent tools. API/agent always validate with Zod. The agent never runs raw SQL.

## Setup

1. Copy `.env.example` → `.env` and fill Supabase keys.
2. Apply migrations (SQL editor or `supabase db push`).
3. Create the admin user (username login):
   ```bash
   node scripts/create-admin-user.mjs yourusername 'your-password'
   ```
4. Run the app:
   ```bash
   npm run dev
   ```

## Build phases

See `.cursor/rules/040-build-phases.mdc`. Do not skip ahead.
