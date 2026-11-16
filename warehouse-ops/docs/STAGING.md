# Staging environment — settings, security, limitations and costs

Last updated: 2026-11-16. **Synthetic data only.** Recurring cost: Supabase $0; web hosting on Railway is
a small usage charge on the founder's existing Railway Hobby plan (approved 2026-11-16; see section 9).

## 1. What exists

| Piece | Where | Status |
|---|---|---|
| Database, login, private file storage | Supabase project **`warehouse-ops-staging`** (ref `xrjgqedeffkrcqhufifc`), org "Real estate", region `us-east-2` (Ohio), **Free plan** | ✅ Live, schema applied, synthetic data loaded, security-tested |
| Web app | **Railway**, project `warehouse-ops-demo`, service `web`: **https://web-production-059ef3bc.up.railway.app** | ✅ Live; sleeps when idle |
| (Earlier attempt) | Netlify project `genuine-rugelach-633898`: builds succeed but every page returns "Page not found"; not used | ⛔ Can be deleted |
| Code | GitHub `jay244521/scaffold-iq`, folder `warehouse-ops/` | ✅ |

Supabase API URL: `https://xrjgqedeffkrcqhufifc.supabase.co`
Publishable key (safe for browsers; Row Level Security limits it): `sb_publishable_5Iz6UqW1NeiwlHy020WKvw_ZfH7aeNr`
The secret / service-role key is **not used anywhere** and must never be added to any hosting provider.

## 2. Synthetic demo data

Loaded with `supabase/demo/synthetic-demo-data.sql`. All companies, people, suppliers, addresses and
POs are fictional. Every email uses `example.com`, a domain reserved by internet standards so mail
can never be delivered to a real person.

**Company 1 — "Lone Star Distribution (Demo)"**: 3 facilities (Dallas DC, Fort Worth Cross-Dock,
Houston Hub), 6 suppliers, 48 receiving exceptions over 90 days, with comments, assignments,
resolution notes and history. Patterns built in for the demo story: Trinity Corrugated → damage,
Pecos Paper / Bluebonnet → shortages, Redline Fastener → wrong items.
Inventory at Dallas DC: 24 records loaded from a "WMS export" a month ago (approved by Marcus), and
**yesterday's cycle count by Tom awaiting review** (4 discrepancies, 1 SKU not in records, 1 invalid row).
Log in as Marcus or Dana → Inventory to demo the approve-and-apply flow.
Each fictional supplier ships items from its own catalog (boxes, dry goods, fasteners, paper, water, totes).
Pattern alerts on the dashboard currently flag Redline Fastener (wrong items rising), Bluebonnet and Pecos Paper
(shortages rising), repeat-problem SKUs and exceptions open over a week. These shift as the dates age.
Try Reports → "Report" next to Trinity Corrugated for a printable supplier discrepancy report.

| Demo login | Role | Shows |
|---|---|---|
| dana.owner@example.com | Owner | Everything, team & facility settings |
| marcus.manager@example.com | Manager | Facilities, all incidents |
| priya.supervisor@example.com | Supervisor | Assign, close, reopen |
| tom.operator@example.com | Operator | Fast incident entry on a phone |
| luis.operator@example.com | Operator | — |
| grace.viewer@example.com | Viewer | Read-only |

**Company 2 — "Gulf Freight Partners (Demo)"**: one owner, `rosa.owner@example.com`, 2 incidents.
Log in as Rosa during a demo to show a prospect that other companies' data is invisible.

All demo accounts share one password, which is **not stored in the repository**. It was given to the
founder privately. To change it: Supabase dashboard → Authentication → Users → user → "Reset password",
or re-run the seed against a fresh project with a new `DEMO_PASSWORD`.

To wipe demo data: run `supabase/demo/remove-synthetic-demo-data.sql` in the Supabase SQL editor.

## 3. Supabase settings

| Setting | Value | Who/how |
|---|---|---|
| Plan | Free ($0). No card on file needed | — |
| Migrations | `20261116001120_core_schema`, `20261116001302_evidence_storage`, `20261116153203_reporting`, `20261116160943_fix_details_history`, `20261116161521_signed_bol`, `20261116163155_inventory_reconciliation`, `20261116170007_exception_patterns` (same files as in `supabase/migrations/`) | Applied |
| Storage bucket | `incident-evidence`: **private**, 10 MB per file, JPEG/PNG/WebP/HEIC/HEIF/PDF only | Applied by migration |
| Email confirmation | On (Supabase default) | Default |
| **Site URL / Redirect URLs** | Set to the Netlify URL once it exists: Site URL `https://<site>.netlify.app`, Redirect URL `https://<site>.netlify.app/auth/callback` | ⏳ Founder, in dashboard → Authentication → URL Configuration |
| **Email templates** | Confirm signup → `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding`; Reset password → `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` | ⏳ Founder (optional until real sign-ups) |
| Minimum password length | Set to 8 to match the app | ⏳ Founder (Authentication → Providers → Email) |
| Outgoing email | Supabase built-in sender (see section 7) | Default |

Security Advisor result after setup: **no errors, no tables without RLS**. It shows warnings that
signed-in users (and, for the invitation preview, signed-out visitors) can call specific
`SECURITY DEFINER` functions. These are **intentional and accepted**: they are the app's designed entry
points (`create_organization`, `create_invitation`, `revoke_invitation`, `accept_invitation`,
`get_invitation_preview`, and the inventory functions `create_inventory_import`, `decide_inventory_lines`,
`apply_inventory_import`, `discard_inventory_import`), each checks the caller's identity and role internally, and each is covered by
the automated tests. The invitation preview only answers someone holding a 256-bit invitation token.
The advisor also notes **Leaked password protection** (checking new passwords against known breaches) is off;
it is a dashboard setting under Authentication → Passwords. Check whether it is available on the Free plan before relying on it.

## 4. Web hosting

**Live demo: https://web-production-059ef3bc.up.railway.app** (log in with the demo accounts in section 2).

### Railway settings (set up and verified by Claude through the Railway connection)
| Setting | Value |
|---|---|
| Project / service | `warehouse-ops-demo` / `web`, region US West |
| Source | GitHub `Jay244521/scaffold-iq`, branch `claude/warehouse-ops-mvp-ceda5s`, root directory `/warehouse-ops` |
| Builds | Railpack, Node 22 (from `package.json` engines), `npm run build`; only rebuilds when files under `/warehouse-ops/**` change |
| Start | `npm run start -- -p 8080 -H 0.0.0.0`; health check `/login` |
| Cost controls | **App sleeping on** (stops when idle, wakes on the next visit in a few seconds); 1 replica; limits 1 vCPU / 1 GB |
| Variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (the Railway URL), `NODE_ENV`, `NEXT_TELEMETRY_DISABLED`. No secrets. |

If an automatic deploy doesn't start after a push, use **Deploy Latest Commit** in Railway (Cmd/Ctrl+K), or ask me.

### Why not Vercel or Netlify
- **Vercel Hobby (free)** is restricted to non-commercial personal use, and a demo for prospective customers is commercial. Ruled out.
- **Netlify Free** allows commercial use and was tried first. Builds succeeded and Netlify reported "Published", but every
  page (even static files) returned Netlify's "Page not found". The cause couldn't be diagnosed without the
  build log, and the Netlify API rejected the access tokens provided. The Netlify project can be deleted; also delete
  the "Claude build check" personal access tokens in Netlify (User settings → Applications).
- **Railway** was chosen because Claude can deploy, read logs and verify it directly. The account is on the paid Hobby plan,
  so this adds a small usage charge (approved by the founder).

### Issue found while deploying (fixed)
Pages under the `(app)` / `(auth)` route-group folders produced JavaScript file paths containing parentheses. When a proxy or
corporate web filter re-encodes them (`%28app%29`), Next.js returns 404 for that file and the page shows "Something went wrong".
Warehouse networks often use such filters, so pages were moved out of route groups; no built file path contains parentheses now.

## 5. Security controls (tested on the live staging project)

Run on 2026-11-16 against `warehouse-ops-staging`:
- `tests/staging/api-isolation.mjs` → **34/34 passed** (re-run after the pattern-alerts migration). It works through the public API with real logins: company B can't read, create, modify or delete company A's incidents, comments, history, people, memberships, invitations, dashboard numbers, reports, inventory or files; nobody, not even an owner, can change inventory quantities directly; viewers can't write; operators can't assign; reporter/status can't be forged; storage rejects HTML; evidence has no public URL; signed-out visitors are refused.
- `tests/staging/demo-smoke.mjs` (app connected to staging, real browser) → **6/6 passed**: dashboard, list and detail render with synthetic data; viewer has no write controls; company B sees only its own data and gets "Page not found" for company A's incident URL.
- Same schema also passes the 181-check database suite and the 69-step browser walkthrough on local Supabase.

Controls in place: Row Level Security on every table; database-enforced roles; server-side
authorization; private evidence bucket with type/size limits and file-signature checks; 10-minute
signed links; append-only history and comments; admin audit log; safe error messages; security
headers; no service-role key anywhere.

## 6. Limitations of the free staging setup

| Limitation | Impact on demos | Mitigation |
|---|---|---|
| **Supabase Free pauses the project after ~7 days with no activity** | Site shows errors until restored | Log in a day before each demo. If paused: Supabase dashboard → project → **Restore** (free, takes a few minutes) |
| No automatic backups on Supabase Free | Synthetic data could be lost | Fine for synthetic data: re-run the seed script |
| Supabase Free: 500 MB database, 1 GB file storage | Not a constraint for demos | — |
| Railway app sleeping | The first visit after a quiet period takes a few seconds to wake | Open the site a minute before a demo |
| Railway usage is billed on the Hobby plan | Small monthly charge | App sleeping and small limits; set a usage limit in Railway billing (recommended: $1–2) |
| Built-in Supabase email: only to your own team's addresses, ~2/hour | Prospects can't self-sign-up or reset passwords on staging | Demo with the pre-made accounts. Invite links are copy-paste and need no email |
| `NEXT_PUBLIC_SITE_URL` must match the real URL | Wrong links in auth emails | Set to the Railway URL; also set Supabase Site URL to it (section 3) |

## 7. Email recommendation (no account created, nothing sent)

| Provider | Free tier (per public comparisons, 2026) | Notes |
|---|---|---|
| **Resend** (recommended) | 3,000/month, 100/day, 1 domain | Simplest Supabase setup (SMTP); requires a domain you own; test sender only delivers to your own address |
| Brevo | ~300/day | Higher daily volume; has a Supabase SMTP guide; heavier marketing-oriented product |
| Mailjet | 6,000/month, 200/day | Good volume |
| SMTP2GO | 1,000/month | Fine for low volume |
| MailerSend / Postmark | 500 / 100 per month | Too small |

**Recommendation: Resend**, connected to Supabase as custom SMTP, when real pilot users need to sign up.
**Blocker: every reputable provider needs a domain you own** to deliver to people other than yourself.
A domain costs roughly $10–15 per year. That's a recurring expense, so it needs your approval. Until then,
staging demos work without sending any email.

## 8. Laptop fallback (if hosting is unavailable)

```bash
cd warehouse-ops && npm install
# .env.local:
# NEXT_PUBLIC_SUPABASE_URL=https://xrjgqedeffkrcqhufifc.supabase.co
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_5Iz6UqW1NeiwlHy020WKvw_ZfH7aeNr
# NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm run build && npm start      # open http://localhost:3000
```

## 9. Recurring costs

| Item | Monthly | Notes |
|---|---|---|
| Supabase Free | $0 | |
| Railway (web hosting) | ~$0.05–$1 estimated | Usage on the existing Hobby plan ($5/mo subscription already paid for other projects). App sleeps when idle. Estimate, not a guarantee; set a usage limit to cap it |
| GitHub + Actions (tests) | $0 | |
| Email provider | $0 | Not set up |
| Domain | $0 | Not purchased; ~$10–15/yr when approved |
| **Total** | **≈ $0–$1 incremental** | Plus the Railway Hobby subscription the account already pays |

**Upgrade path, not approved and not needed for demos:** Supabase Pro $25/mo (no pausing, backups) and a
domain, when the first pilot uses real data.
