# Production-readiness checklist

✅ done and tested · ⬜ to do before real customer data · 🔜 later phase

## Security
- ✅ Row Level Security on every table; 125 automated checks (cross-tenant reads/writes, roles, storage, invitations, audit) pass on plain PostgreSQL **and** real Supabase
- ✅ Tests are shown to catch regressions (a deliberately broken policy makes them fail)
- ✅ Server-side authorization in every server action, re-enforced by the database
- ✅ Browser-supplied org / facility / user ids are verified; reporter, resolver and timestamps are set by the database
- ✅ No service-role key anywhere in the app
- ✅ Private evidence bucket; size/type limits at three layers; content signature check; 10-minute signed URLs
- ✅ Append-only incident history and comments; admin audit log; neither editable by users
- ✅ Safe error messages (no SQL/constraint details shown); generic error page
- ✅ Open-redirect protection on login `next=`; search input sanitized for API filter syntax
- ✅ Security headers (no framing, nosniff, HSTS, referrer policy); `npm audit`: 0 vulnerabilities
- ⬜ Turn on leaked-password protection and review rate limits (Supabase → Auth)
- ⬜ Custom SMTP sender for auth emails (needs your approval of a provider)
- ⬜ Run Supabase Security Advisor on the production project; resolve findings
- ⬜ Content-Security-Policy header (tighten after the AI phase settles external calls)
- ⬜ Enable MFA for owner/admin accounts (Supabase supports TOTP)
- ⬜ Independent review / penetration test before handling a large customer's data

## Reliability & operations
- ⬜ Supabase Pro for daily backups and no auto-pause (paid — approval needed)
- ⬜ Error monitoring (free tiers exist; approval needed before adding a service)
- ⬜ Uptime check on the login page
- ⬜ Clean-up job for evidence files uploaded but never registered (rare: browser closed mid-upload; files remain private)
- ⬜ Document a data-export / deletion process for customers leaving

## Legal / business
- ⬜ Terms of Service, Privacy Policy and a short Data Processing Addendum
- ⬜ Hosting plan that permits commercial use (Vercel Hobby does not)
- ⬜ Company name and domain

## Product
- ✅ Signup / login / logout / password reset / email confirmation flow
- ✅ Organization onboarding, facilities, invitations, six roles, facility selection
- ✅ Dashboard, incident entry with evidence, assignment, status, resolution, comments, history, search & filters
- ✅ Responsive: verified with no horizontal scrolling at 320 px on every app page
- ⬜ Edit incident details after submission (supervisors) — database rules exist, UI not yet
- 🔜 Phase 4: Reports page, CSV export
- 🔜 Phase 5: Inventory CSV import, preview, discrepancy review & approval
- 🔜 Phase 6: AI summaries, supplier reports, recommendations (human-approved only)
- ⬜ Facility time zones (dates currently show in each viewer's own time zone; list filters use UTC days)
