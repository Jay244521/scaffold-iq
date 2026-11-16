# Staging environment — settings, security, limitations and costs

Last updated: 2026-11-16. **Synthetic data only. Recurring cost: $0.**

## 1. What exists

| Piece | Where | Status |
|---|---|---|
| Database, login, private file storage | Supabase project **`warehouse-ops-staging`** (ref `xrjgqedeffkrcqhufifc`), org "Real estate", region `us-east-2` (Ohio), **Free plan** | ✅ Live, schema applied, synthetic data loaded, security-tested |
| Web app | Netlify (Free plan) — **needs a one-time setup in your Netlify account** (section 4); I can't create accounts on your behalf | ⏳ Ready to connect |
| Code | GitHub `jay244521/scaffold-iq`, folder `warehouse-ops/` | ✅ |

Supabase API URL: `https://xrjgqedeffkrcqhufifc.supabase.co`
Publishable key (safe for browsers; Row Level Security limits it): `sb_publishable_5Iz6UqW1NeiwlHy020WKvw_ZfH7aeNr`
The secret / service-role key is **not used anywhere** and must never be added to Netlify.

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

## 4. Web hosting: why Netlify, and how to connect it

**Vercel (Hobby/free) is not allowed for this use.** Vercel's fair-use guidelines restrict the free Hobby
plan to *non-commercial personal use*, and treat any deployment used for the financial gain of anyone
involved as commercial. Demoing our product to prospective paying customers is commercial. (Paid Vercel
Pro is $20/month — not approved.)

| Option ($0) | Commercial use on free plan | Fit for this app | Verdict |
|---|---|---|---|
| **Netlify Free** | Allowed — Netlify's own announcement of the Free plan covers commercial projects | Full Next.js support (middleware, server actions) via Netlify's built-in runtime | **Chosen** |
| Render Free | No restriction found, but free instances are intended for hobby/testing | Works, but sleeps after 15 min idle; first visit waits ~30–60 s | Backup option |
| Cloudflare Workers Free | Allowed | 3 MB bundle cap and very small CPU budget per request; Next.js middleware support incomplete | Too risky for a live demo |
| Vercel Hobby | **Not allowed** | — | Ruled out |

> Verify before relying on it: I confirmed these terms from web search results of the providers' pages
> and docs; this environment couldn't open netlify.com or vercel.com directly. Read Netlify's current
> Terms and pricing page once when you create the account.

**One-time Netlify setup (about 10 minutes, $0, no credit card):**
1. Sign up at netlify.com with your GitHub account. Choose the **Free** plan. Do not add a payment method.
2. **Add new project → Import an existing project → GitHub →** `jay244521/scaffold-iq`.
3. Branch to deploy: `claude/warehouse-ops-mvp-ceda5s` (or `main` after this work is merged).
4. **Base directory: `warehouse-ops`**. Leave the build command and publish directory alone (read from `netlify.toml`).
5. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://xrjgqedeffkrcqhufifc.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_5Iz6UqW1NeiwlHy020WKvw_ZfH7aeNr`
   - `NEXT_PUBLIC_SITE_URL` = the site's URL (e.g. `https://warehouse-ops-demo.netlify.app`; rename the site first under Site configuration → Change site name)
6. Deploy. Then in **Site configuration → Build & deploy → Deploy Previews: "Don't deploy pull requests"**, to save credits.
7. Put the site URL into Supabase (section 3, Site URL / Redirect URLs).
8. Check: open the site, log in as `dana.owner@example.com`, then as `rosa.owner@example.com`.

Once it's connected, tell me the URL and I'll run the staging test suites against the live site.

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
| Netlify Free: 300 credits/month; deploys and traffic consume credits (third-party reports say ~15 credits per production deploy) | Roughly 15–20 deploys a month plus demo traffic | Netlify skips builds when nothing in `warehouse-ops/` changed (base directory); deploy previews off |
| Netlify Free pauses the site when credits run out (no charge) | Site offline until next month | Keep a local fallback: `npm run dev` on a laptop pointed at staging (section 8) |
| Netlify community reports (Jul–Aug 2026) of free sites wrongly paused by a credit bug | Possible surprise outage | Check the site the day before a demo; use the laptop fallback |
| Built-in Supabase email: only to your own team's addresses, ~2/hour | Prospects can't self-sign-up or reset passwords on staging | Demo with the pre-made accounts. Invite links are copy-paste and need no email |
| `NEXT_PUBLIC_SITE_URL` must match the real URL | Wrong links in auth emails | Set it in step 5 above |

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
| Netlify Free | $0 | No payment method on file, so it can't bill |
| GitHub + Actions (tests) | $0 | |
| Email provider | $0 | Not set up |
| Domain | $0 | Not purchased; ~$10–15/yr when approved |
| **Total** | **$0** | |

**Upgrade path, not approved and not needed for demos:** Supabase Pro $25/mo (no pausing, backups) and a
domain, when the first pilot uses real data.
