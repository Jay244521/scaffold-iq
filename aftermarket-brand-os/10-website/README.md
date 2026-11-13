# 10 — Website (aftermarket storefront)

- `index.html` is the source: a RealTruck-style storefront (year/make/model fit finder, a Maintenance Parts department plus 5 accessory categories, catalog with honest availability, Cargo System flagship, dealer/installer programs). The preview is published as a private Claude artifact.
- `deploy/index.html` is the same page as a complete HTML document, ready for any static host.

## Before it goes public
1. **Choose and screen the brand name.** "Keelwell" is a working name that has **not** been trademark-checked. Run the screening in `03-brand/10-brand-naming-and-identity.md` first. Then find-and-replace "Keelwell" and the contact email in both files.
2. **Create two free Google Forms:**
   - *Reserve a kit:* name, phone or email, kit choice (Care Kit / Pet Owner Kit), DFW area or ZIP, pickup or delivery.
   - *Wholesale sample:* business name, contact, business type, address.

   Paste each form's link into `RESERVE_FORM_URL` and `WHOLESALE_FORM_URL` in the `<script>` at the bottom of the page.
3. **Check every claim before publishing.** The towel sizes, 30-day returns and reply times must match what you actually sell and do. The page makes no review, "Texas-tested" or "Made in USA" claims; keep it that way until they're true.
4. **Add a short privacy note** to the form ("We use your details only to arrange your order").

## Free hosting options (no subscription)
- GitHub Pages, Cloudflare Pages or Netlify (free tiers): upload `deploy/index.html`, then point your domain at it once the domain purchase is approved.
- Or rebuild the same content on the Square Online free plan if you want built-in checkout later.

## Editing the catalog and vehicles
Everything shown is driven by three lists in the `<script>`:
- `VEHICLES`: make → model → body class (sedan / compact / midsize / fullsize). Add models here.
- `PRODUCTS`: each product's category, status (`now`, `dev`, `plan`), price (only for `now`) and which body classes it fits.
- `CATS`: the six categories (Maintenance Parts + 5 accessory categories).

Change a product's `status` to `"now"` and give it a `price` when it launches. The fit finder, category counts and catalog all update automatically. This list is the seed of the fitment database described in the expansion strategy.
