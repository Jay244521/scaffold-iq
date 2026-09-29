# AURA Launch Checklist

This follows the AURA blueprint step by step. Tick each box as you go.
`[x]` means done in this repo. `[ ]` means it still needs you, because it involves accounts, money or people.

---

## Phase 1 — Digital Foundation

**Goal:** a "Coming Soon / Pre-Order Drop" store that captures demand and validates revenue before bulk manufacturing.

### 1.1 Pre-order page
- [x] Minimal, editorial landing page using the AURA brand system: Espresso `#362D28`, Terracotta `#C86D44`, Sage `#848C79` and Cream `#F4F1EA`, with Syne and Montserrat set centred and widely tracked
- [x] All four launch products, each with its packaging colour and key features
- [x] Waitlist sign-up saving to Supabase (`aura_waitlist` table)
- [ ] Deploy: in Vercel, set Framework Preset to **Other** and clear the build command, then merge the PR
- [ ] Sign up once on the live site and confirm the row appears in Supabase

### 1.2 Shopify Starter store (validates revenue)
- [ ] Create a Shopify account on the **Starter** plan (about $5/month; check current pricing)
- [ ] Add one product, **AURA Drop 01 — The Complete Suite**. Mark it as a pre-order in the description and set the ship window, for example "Ships in 4–6 weeks"
- [ ] In the product page, click **Copy checkout link**
- [ ] Paste the link into `SHOPIFY_PREORDER_URL` in `assets/script.js` and push. The "Pre-order Drop 01" buttons then appear, and the status line changes to "Pre-orders open"
- [ ] Email the waitlist (export CSV from Supabase) to tell them pre-orders are open, before posting anywhere else

**Revenue check:** set a target number of pre-orders before you place the bulk manufacturing order. Only commit to inventory once it's hit.

### 1.3 Domain and handles
- [ ] Buy `eat-aura.com` or `aurasnacks.com` (roughly $10–20 a year)
- [ ] Vercel: **Settings → Domains → Add**, then follow the DNS steps it shows
- [ ] Claim `@aurasnacks` on TikTok, Instagram and YouTube. If it's taken, use `@eat.aura`
- [ ] Update the handles in the `#journal` section of `index.html` and turn them into links

---

## Phase 2 — Creator Seeding Flywheel

**Goal:** get the full product suite into the hands of 30–50 micro-creators (5k–50k followers) in wellness, minimalist workspace and daily routine niches.

### 2.1 Build the list
- [ ] Fill in `launch/creator-seeding.csv`, with one row per creator
- [ ] **Keep shipping addresses out of this repo.** It's public. Store addresses somewhere private, such as your Shopify admin or a private spreadsheet
- [ ] Only list creators whose followers fit the target: 5k–50k, in the wellness, desk setup or routine niches
- [ ] Aim for 50 candidates so you still reach 30 after people decline

### 2.2 Outreach
- [ ] DM or email each creator. Ask before you ship, and get a shipping address
- [ ] Keep it short. Say who you are, that AURA is bootstrapped, that you'd like to send them the full suite for free, and that there's no obligation to post

### 2.3 PR boxes ($300 of the $400)
- [ ] Each box holds all three sprouted blends and Focus Elixir stick packs
- [ ] Price one box end to end (product, packaging, insert card, postage) before ordering supplies

**Budget check:** $300 across 30–50 boxes is **$6–$10 per box, shipping included**. Domestic postage alone often uses most of that. If a box comes in above $10, send fewer, better boxes (for example 30 at $10), rather than cutting the product suite.

- [ ] Add a small insert card with the site address and "Pre-order Drop 01"
- [ ] Record ship dates and tracking numbers in the tracker

### 2.4 Follow up
- [ ] About 10 days after delivery, send one thank-you message. Don't chase for posts
- [ ] Log who posted, and repost with permission
- [ ] Ask whether they'd like a code for their audience once pre-orders open

---

## Phase 3 — Build-in-Public Content Engine

**Goal:** document the bootstrap journey **daily** as short-form video (TikTok, Reels, Shorts) to build hype before the drop.

### 3.1 Daily routine
- [ ] Post one video a day, cross-posted to all three platforms
- [ ] End every video with the same call to action: "Join the Drop 01 list, link in bio"
- [ ] Put the site URL in every bio

### 3.2 First 14 days of prompts
| Day | Video |
|----:|-------|
| 1  | "I'm launching a snack brand with $400." The plan in 30 seconds |
| 2  | Why zero seed oils, and what that rules out on a normal snack label |
| 3  | What sprouting is: soaking nuts and seeds, shown on camera |
| 4  | Revealing the brand: the name, the four colours, why it looks like a lifestyle product |
| 5  | Walking through the pre-order site, and asking viewers to join the list |
| 6  | Sampling Flavour 01: Cacao & Sea Salt almonds |
| 7  | Sampling Flavour 02: Turmeric & Honey cashews |
| 8  | Sampling Flavour 03: Matcha & Maca pumpkin seeds |
| 9  | Focus Elixir: who it's for, and a desk-setup morning routine |
| 10 | The $400 budget, line by line |
| 11 | Packing the first PR box |
| 12 | How creators get picked (without naming them before they agree) |
| 13 | A mistake so far and what it cost |
| 14 | Waitlist count update, and the pre-order date |

### 3.3 Track what works
- [ ] Each week, note the waitlist count (Supabase row count) next to your top video
- [ ] Make more of whatever moves sign-ups

---

## Budget ($400)

| Item | Blueprint | Estimate |
|------|-----------|----------|
| Creator PR boxes (product, packaging, postage) | $300 | $300 |
| Domain (1 year) | — | ~$10–20 |
| Shopify Starter (first 2–3 months) | — | ~$15 |
| Hosting (Vercel) and waitlist (Supabase) | — | $0 on free plans |
| Reserve (samples, supplies, reshipping) | — | ~$65–75 |
| **Total** | **$400** | **$400** |

Paid ads: $0, following the blueprint.
