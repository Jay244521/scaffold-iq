# Vanta landing page

Static site (HTML/CSS/JS) + one Cloudflare Pages Function for the inquiry form.

## Run locally
1. Install Node.js 20+.
2. `npm install`
3. `cp .dev.vars.example .dev.vars` and fill in values (or leave unset to test the page only; the form will say it isn't configured).
4. `npm run dev` then open http://localhost:8788

Page-only preview (no form backend): `npx serve .`

## Environment variables (server-side only)
| Name | Required | Purpose |
|---|---|---|
| RESEND_API_KEY | Yes | Sends inquiry emails via Resend (secret) |
| TO_EMAIL | Yes | Where inquiries are delivered |
| FROM_EMAIL | Yes | Verified sender, e.g. `Vanta <inquiries@yourdomain.com>` |
| TURNSTILE_SECRET_KEY | Optional | Enables bot check (secret) |

The Turnstile **site key** is public: paste it into `data-sitekey` in `index.html`.

## Deploy (Cloudflare Pages)
1. Push this folder to a GitHub repo.
2. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git.
3. Build command: (none). Build output directory: `/` (or `.`).
4. After first deploy: Settings > Variables and Secrets > add the variables above (Production), then redeploy.
5. Custom domain: Pages project > Custom domains.
6. Replace `https://www.example.com` in `index.html`, `robots.txt`, `sitemap.xml`, and the footer contact placeholders.

## Before launch checklist
- Replace placeholder email/phone in the footer.
- Verify your domain in Resend (add the DNS records it gives you).
- Send a test inquiry end to end.
- Consider adding a short privacy notice page.
