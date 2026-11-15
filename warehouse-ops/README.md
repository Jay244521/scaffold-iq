# Warehouse Ops

Receiving and inventory exception management for independent warehouses, distributors,
manufacturers and 3PLs. Teams log shortages, overages, damage and wrong items at the dock
(with photos), track each exception to resolution, and see supplier patterns.

> Status: **MVP — Phases 1–3 complete** (auth, organizations, facilities, team, dashboard,
> incidents with evidence, assignment, status, comments, history, search/filters).
> Reporting/CSV export, inventory reconciliation and AI are next. See `docs/PROJECT_AUDIT.md`.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth,
private Storage) · Zod. No paid services. The app never uses the Supabase service-role key.

---

## Run it on your computer

You need **Node.js 20+** (https://nodejs.org) and **Docker Desktop** (https://docker.com — free
for small businesses) for the local database.

```bash
cd warehouse-ops
npm install                 # 1. install packages (first time only)
npx supabase start          # 2. start a local Supabase (database, login, file storage)
cp .env.example .env.local  # 3. create your settings file
```

`npx supabase start` prints a **Publishable key** (`sb_publishable_…`). Open `.env.local` and set:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<the publishable key it printed>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
npm run dev                 # 4. start the app → open http://localhost:3000
```

Sign up, create your company, and you're in. Locally, emails (confirmations, password resets)
are captured at http://127.0.0.1:54324 instead of being sent.

To stop: press `Ctrl+C` in the app window, then `npx supabase stop`.

## Tests

| Command | What it proves |
|---|---|
| `npm run test:unit` | Validation, permissions and file-type checks (20 tests) |
| `npm run test:db` | **125 database security checks** on a throwaway PostgreSQL: one company can't read or change another's data; role rules; private storage; invitations; audit log. Needs PostgreSQL installed, or set `DATABASE_URL`. |
| `npm run test:db -- --supabase` | The same 125 checks against your running local Supabase |
| `node tests/e2e/walkthrough.mjs` | 33-step browser walkthrough (signup → incidents → invites → second company blocked). Needs the app running against local Supabase and Playwright installed. |
| `npm run typecheck` / `npm run build` | TypeScript and production build |

GitHub Actions runs typecheck, unit tests, database security tests and the build on every push
(`.github/workflows/warehouse-ops.yml`, free for this usage).

## How it's organized

```
supabase/
  migrations/          Database: tables, Row Level Security policies, triggers, storage bucket
  security-tests/      SQL tests that try to break tenant isolation and role rules
  config.toml          Local Supabase settings
src/
  middleware.ts        Refreshes login sessions; sends signed-out users to /login
  lib/                 Server context (org/facility), permissions, validation, file checks
  app/(auth)/          Sign up, log in, password reset
  app/onboarding/      Create your company workspace
  app/invite/[token]/  Accept a team invitation
  app/(app)/           The product: dashboard, incidents, settings
tests/unit/            Unit tests     tests/e2e/   Browser walkthrough
docs/                  Audit & plan, deployment guide, production checklist
```

## Security model (short version)

- **Tenant isolation in the database.** Every record belongs to an organization. PostgreSQL Row
  Level Security only returns or changes rows for organizations you belong to — even if the web
  app had a bug. Child records (comments, evidence, history) are tied to their incident's
  organization with composite foreign keys.
- **Nothing from the browser is trusted.** Organization, facility, reporter, status timestamps
  and roles are checked or set by the server and database, never taken from the form.
- **Roles:** owner › admin › manager › supervisor › operator › viewer, enforced by RLS policies and
  database triggers (e.g. only supervisors+ assign or close; only owners grant ownership; an
  organization always keeps an owner).
- **Evidence** is in a private bucket under `{org}/{incident}/`. 10 MB limit and allowed types are
  enforced by Storage, by the app (including checking the file's real bytes — a renamed HTML file
  is rejected) and by the database. Files are viewed via signed links that expire in 10 minutes.
- **History & audit:** incident history and admin audit log are written by database triggers and
  can't be edited or deleted by any user.
- **Invitations** are single-use, expire in 7 days, only work for the invited (confirmed) email,
  and only a hash of the token is stored.

Details: `docs/PRODUCTION_CHECKLIST.md`.
