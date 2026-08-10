# Master build prompt — Facility Ops Agent

Paste this into a new Cursor chat once the `.cursor/rules/*.mdc` files are in place. The rules give Cursor persistent context; this prompt kicks off execution.

---

I'm building a facility ops agent for a single site: a chat agent backed by a dashboard, tracking kitchen inventory, IT equipment, generator maintenance/fuel, solar system specs/monitoring, and internet & utility accounts. Full context, schema, stack, and phase plan are in `.cursor/rules/`. Read `000-project-overview.mdc`, `010-tech-stack.mdc`, `020-data-model.mdc`, `030-agent-behavior.mdc`, and `040-build-phases.mdc` before doing anything.

Build strictly phase by phase per `040-build-phases.mdc`. Do not jump ahead to a later phase even if it seems efficient. At the end of each phase:
1. Summarize what was built.
2. Tell me exactly what to test manually.
3. Wait for me to confirm before updating "Current phase" in `040-build-phases.mdc` and starting the next one.

Start with **Phase 0 — Foundation** now:
- Scaffold the Next.js + TypeScript project per the folder structure in `010-tech-stack.mdc`.
- Set up Supabase: write migrations for all 5 domain table groups from `020-data-model.mdc`.
- Set up Supabase Auth with a single admin user.
- Create a Storage bucket for solar spec files.
- Build only a login page and an empty dashboard shell — no domain UI yet.

Ask me for any Supabase project keys or env vars you need rather than guessing at them.
