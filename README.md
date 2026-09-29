# AURA — Drop 01 Pre-Order Site

A static "Coming Soon / Pre-Order Drop" landing page for AURA. It collects waitlist emails so you can confirm demand before bulk manufacturing.

It is plain HTML, CSS and JS, with no build step and no dependencies.

```
index.html           page markup and copy
assets/styles.css    brand tokens, layout, CSS pouch mockups
assets/script.js     waitlist form handler (set WAITLIST_ENDPOINT here)
assets/favicon.svg
vercel.json
```

## Brand system

| Token        | Hex       | Use                          |
|--------------|-----------|------------------------------|
| Espresso     | `#362D28` | Structure, text, dark panels |
| Terracotta   | `#C86D44` | Accent, CTAs                 |
| Sage         | `#848C79` | Wellness / botanical panels  |
| Cream        | `#F4F1EA` | Background, reversed text    |

Headings use Syne and body text uses Montserrat, both from Google Fonts.

## Before you share the link

1. **Connect the waitlist.** Create a free form at [formspree.io](https://formspree.io) and paste its URL into `WAITLIST_ENDPOINT` at the top of `assets/script.js`. Until you do, the form checks the email but **does not save it**. Visitors see a "waitlist opens shortly" message instead.
2. **Confirm your handles.** The page shows `@aurasnacks` as plain text with no link. Once you've secured the accounts, you can turn the handles in the `#journal` section of `index.html` into links.
3. **Check the product claims.** Terms like "Non-GMO verified" and "adaptogenic" come straight from the blueprint. Make sure your supplier documents support them before launch.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

Vercel serves the repo root as a static site with no framework and no build command. If the Vercel project is still set up for the old Create React App build, open **Settings → Build & Development**, set the Framework Preset to **Other**, and clear the build command and output directory. You can then point `eat-aura.com` or `aurasnacks.com` at it under **Settings → Domains**.
