# AURA — Drop 01 Pre-Order Site

A static "Coming Soon / Pre-Order Drop" landing page for AURA. It collects waitlist emails so you can confirm demand before bulk manufacturing.

It is plain HTML, CSS and JS, with no build step and no dependencies.

```
index.html           page markup and copy
assets/styles.css    brand tokens, layout, CSS pouch mockups
assets/script.js     waitlist form handler (posts to Supabase)
assets/favicon.svg
vercel.json
LAUNCH.md            step-by-step blueprint checklist (Phases 1–3, budget)
launch/              creator seeding tracker (CSV)
```

## Brand system

| Token        | Hex       | Use                          |
|--------------|-----------|------------------------------|
| Espresso     | `#362D28` | Structure, text, dark panels |
| Terracotta   | `#C86D44` | Accent, CTAs                 |
| Sage         | `#848C79` | Wellness / botanical panels  |
| Cream        | `#F4F1EA` | Background, reversed text    |

Headings use Syne and body text uses Montserrat, both from Google Fonts.

## Pre-orders (Shopify)

Leave `SHOPIFY_PREORDER_URL` in `assets/script.js` empty while the drop is "coming soon". Once your Shopify Starter product exists, paste its checkout link there. "Pre-order" buttons then appear on the page, and the status line changes to "Pre-orders open".

## Waitlist

Both sign-up forms save to the `aura_waitlist` table in Supabase (project `bkstqsewmsmotpqwwhmj`). To see sign-ups, open **Table Editor → aura_waitlist** in the Supabase dashboard, where you can also export them to CSV.

| Column       | Notes                                                             |
|--------------|-------------------------------------------------------------------|
| `email`      | Unique and case-insensitive, so repeat sign-ups are ignored       |
| `source`     | Which form was used: `top` (hero) or `join` (bottom of the page)  |
| `created_at` | Time of sign-up (UTC)                                             |

Visitors can add their email but cannot read, edit or delete the list. The table permissions enforce this, so the publishable key in `assets/script.js` is safe to have in public code.

## Before you share the link

The full step-by-step plan is in [LAUNCH.md](LAUNCH.md). The items below are the website-specific ones.


1. **Confirm your handles.** The page shows `@aurasnacks` as plain text with no link. Once you've secured the accounts, you can turn the handles in the `#journal` section of `index.html` into links.
2. **Check the product claims.** Terms like "Non-GMO verified" and "adaptogenic" come straight from the blueprint. Make sure your supplier documents support them before launch.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

Vercel serves the repo root as a static site with no framework and no build command. If the Vercel project is still set up for the old Create React App build, open **Settings → Build & Development**, set the Framework Preset to **Other**, and clear the build command and output directory. You can then point `eat-aura.com` or `aurasnacks.com` at it under **Settings → Domains**.
