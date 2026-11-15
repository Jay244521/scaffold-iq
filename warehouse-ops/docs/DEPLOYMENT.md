# Deploying Warehouse Ops

Target: **Supabase** (database, login, file storage) + **Vercel** (web app). Both have free tiers.
Do not put real customer data in until you've worked through `PRODUCTION_CHECKLIST.md`.

## Costs — read first

| Service | Free tier | Limit that matters | When to upgrade |
|---|---|---|---|
| Supabase Free | $0 | 500 MB database, 1 GB files, **project pauses after 7 days without activity**, no automatic backups | Paying customers → **Pro, $25/month** (no pausing, daily backups) |
| Vercel Hobby | $0 | **Non-commercial use only** under Vercel's terms | Selling to businesses → **Pro, $20/month**, or a host that allows commercial free use |
| Email (sign-up / reset emails) | Supabase built-in | Built-in sender is rate-limited and meant for testing; it may only deliver to your own team's addresses | Before real users: a transactional email provider (several have free tiers, e.g. ~3,000 emails/month) |

Demo stage: **$0/month**. First paying customer: roughly **$45/month** plus a domain (~$12/year).
Nothing here is purchased without your approval.

## 1. Create the Supabase project (free)

1. Sign in at https://supabase.com → **New project**. Pick a region near your customers (e.g. US East),
   generate a strong database password and save it in a password manager.
2. Push the database schema from your computer:
   ```bash
   cd warehouse-ops
   npx supabase login
   npx supabase link --project-ref <your-project-ref>   # from the project URL
   npx supabase db push                                  # applies supabase/migrations
   ```
3. **Authentication → URL Configuration:** Site URL = your app URL (e.g. `https://warehouse-ops.vercel.app`).
   Add `https://<your-app>/auth/callback` to Redirect URLs.
4. **Authentication → Providers → Email:** keep "Confirm email" **on**. Minimum password length: 8.
5. **Authentication → Email Templates → Confirm signup:** change the link to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
   and **Reset password** to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
   (This lets people open the email on a different device than where they signed up.)
6. **Project Settings → API Keys:** copy the Project URL and the **publishable** key. You will
   **not** need the secret / service-role key for this app — don't paste it anywhere.

## 2. Deploy the app on Vercel

1. https://vercel.com → **Add New → Project** → import this GitHub repository.
2. **Root Directory: `warehouse-ops`** (important — the repo contains other projects).
3. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = publishable key
   - `NEXT_PUBLIC_SITE_URL` = the Vercel URL (update after the first deploy if needed)
4. Deploy. Then set Supabase's Site URL (step 1.3) to the final URL.

## 3. Verify

- Sign up with a real email; confirm; create a company; report an incident with a photo.
- In a private window, sign up as a second company and confirm you can't see the first company's data.
- Supabase dashboard → **Advisors → Security**: should show no errors for the `public` schema.

## Updating

Push to the branch Vercel deploys from. For database changes, add a new file in
`supabase/migrations/`, run `npm run test:db`, then `npx supabase db push`.
Never edit a migration that has already been applied to production.
