# Phase 1 audit and implementation plan (2026-11-15)

## 1. What was inspected

The brief asked to build from `warehouse-ops-starter.zip`. **That ZIP was not present in this
workspace** — not in the repository, the session's upload area or anywhere on the machine.
The repository (`scaffold-iq`) contained three unrelated projects:

| Path | What it is | Reusable? |
|---|---|---|
| `/` (src, public) | Fort Worth permit-lead dashboard (Create React App, JavaScript) | No — different stack |
| `apexfield-ai/` | Next.js 15 + Supabase app (HVAC field coaching) | **Patterns only**: Supabase SSR auth, middleware, config, Next 15 setup |
| `radar/` | Python data pipeline | No |

**Decision:** rather than stop, build Warehouse Ops as a new self-contained app in
`warehouse-ops/` on exactly the required stack, reusing the proven Next.js 15 + `@supabase/ssr`
patterns from `apexfield-ai`. No other project was modified. If you still have the ZIP, upload it
and I'll reconcile anything worth keeping from it.

## 2. Problems found and fixed while setting up

| Issue | Fix |
|---|---|
| No starter / no schema / no auth for this product | Built from scratch (below) |
| `npm audit`: high-severity PostCSS advisory bundled inside Next.js | `overrides` pins patched PostCSS → **0 vulnerabilities** without a risky Next 16 jump |
| Latest TypeScript (7.x) not supported by Next 15 | Pinned TypeScript 5.9 |
| Protected pages were prerendered as static at build time | Forced dynamic rendering for all pages |
| Serverless hosts cap request bodies (Vercel 4.5 MB, Netlify ~6 MB) — server-side uploads would fail for phone photos | Browser uploads directly to private Storage under RLS; the server then verifies and registers each file |
| React 19 auto-resets forms after submit → typed input lost on validation errors, and the status dropdown silently reverted (found by the E2E test) | Shared `useFormAction` hook submits without auto-reset |
| Supplier table caused sideways scrolling on phones | Fixed; every page verified at 320 px |
| Real Supabase Storage blocks direct SQL deletes and sets `owner_id` itself | Test harness mimics the Storage API so tests run identically on real Supabase |

## 3. Status by module

| Module | Status |
|---|---|
| A Authentication | ✅ signup, login, logout, password reset, email confirmation, protected pages, membership |
| B Organizations & facilities | ✅ secure onboarding, facilities CRUD/deactivate, invitations, 6 roles, role changes, facility selector |
| C Dashboard | ✅ totals, open/in progress/resolved, avg resolution time, categories, supplier patterns, recent; 7/30/90/all ranges; facility scope |
| D Incident creation | ✅ 5 types, supplier, facility, PO, shipment ref, SKU, qty expected/received (+variance), description, date/time, photos/PDFs |
| E Tracking | ✅ assignment, status, comments, resolution notes, history, search, filters, responsible employee, resolution timestamps · ⬜ edit details UI |
| F Evidence | ✅ private storage, 10 MB, type allowlist + content check, authorization, signed URLs |
| G Reporting | 🔜 Phase 4 (summary function already supports date filtering) |
| H Inventory reconciliation | 🔜 Phase 5 |
| I AI | 🔜 Phase 6 |

## 4. Prioritized plan from here

1. **Phase 4 — Reporting:** Reports page (by supplier, by category, unresolved aging, resolution
   times, date range), CSV export (with spreadsheet-formula injection protection), supervisor
   "edit incident details".
2. **Phase 5 — Inventory reconciliation:** CSV upload → parse in a size-limited, formula-safe way →
   column mapping and validation preview → discrepancy list (system vs counted) → proposed
   corrections that require a named human approval; nothing overwritten silently; everything audited.
3. **Phase 6 — AI (optional, needs your approval for an API provider and spend cap):** incident
   summaries, recurring-pattern detection, supplier discrepancy report drafts, suggested next
   steps. Read-only: AI output is a draft a person must accept; it cannot change inventory,
   close incidents or contact suppliers.
4. **Phase 7 — Hardening & launch:** checklist in `PRODUCTION_CHECKLIST.md`, staging project,
   pilot with one friendly warehouse using non-sensitive data.
