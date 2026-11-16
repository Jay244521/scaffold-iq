# Deploying Warehouse Ops

Target: **Supabase** (database, login, file storage) + **Netlify** (web app), both on free plans.
The live staging setup, its exact settings, limitations and costs are in **`STAGING.md`**.
Do not put real customer data in until you've worked through `PRODUCTION_CHECKLIST.md`.

## Costs and constraints — read first

| Service | Free tier | Limit that matters |
|---|---|---|
| Supabase Free | $0 | 500 MB database, 1 GB files, **pauses after ~7 days without activity**, no automatic backups |
| Netlify Free | $0, no card needed | 300 credits/month; site pauses (no charge) if exhausted. Commercial use allowed |
| Vercel Hobby | — | **Not usable**: restricted to non-commercial personal use |
| Email | Supabase built-in | Only delivers to your own team's addresses, ~2/hour. Real users need a provider + a domain (approval needed) |

Current recurring cost: **$0**. Paid upgrades are not approved.

## 1. Create the Supabase project (free)

1. Sign in at https://supabase.com → **New project**. Pick a region near your customers (e.g. US East),
   generate a strong database password and save it in a password manager.
2. Push the database schema from your computer (or ask me to apply it through the Supabase connection):
   ```bash
   cd warehouse-ops
   npx supabase login
   npx supabase link --project-ref <your-project-ref>   # from the project URL
   npx supabase db push                                  # applies supabase/migrations
   ```
3. **Authentication → URL Configuration:** Site URL = your app URL (e.g. `https://warehouse-ops-demo.netlify.app`).
   Add `https://<your-app>/auth/callback` to Redirect URLs.
4. **Authentication → Providers → Email:** keep "Confirm email" **on**. Minimum password length: 8.
5. **Authentication → Email Templates → Confirm signup:** change the link to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
   and **Reset password** to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
   (This lets people open the email on a different device than where they signed up.)
6. **Project Settings → API Keys:** copy the Project URL and the **publishable** key. You will
   **not** need the secret / service-role key for this app — don't paste it anywhere.

## 2. Deploy the app on Netlify

Follow the step-by-step in `STAGING.md` → section 4 (base directory `warehouse-ops`; set the three
`NEXT_PUBLIC_…` variables; turn off deploy previews). `netlify.toml` holds the build settings.

## 3. Verify

- Sign up with a real email; confirm; create a company; report an incident with a photo.
- In a private window, sign up as a second company and confirm you can't see the first company's data.
- Supabase dashboard → **Advisors → Security**: should show no errors for the `public` schema.

## Updating

Push to the branch Netlify deploys from. For database changes, add a new file in
`supabase/migrations/`, run `npm run test:db`, then `npx supabase db push`.
Never edit a migration that has already been applied to production.
