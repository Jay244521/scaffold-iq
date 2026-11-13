# 13 — Financial Model (guide and key results)

**Model file:** [`operating-workbook.xlsx`](operating-workbook.xlsx), with these tabs:
- `Unit Economics`
- `Scenarios`
- `Budget Tracker`
- `Opportunity Matrix`
- `Supplier Database`

Blue cells are inputs. Yellow cells must be replaced with real quotes. All results are live formulas (479 of them, recalculated with zero errors).

> **These are scenarios, not forecasts.** Every supplier cost is a listing price or an assumption until a written quote replaces it. Profit figures are **pre-tax operating profit**. They are not net profit.

## 1. Unit economics (1 unit per order)
| | Care Kit (US-sourced) | Care Kit (overseas) | Brush kit | Pet-hair tool | Pet cargo liner | Trunk organizer |
|---|---|---|---|---|---|---|
| Retail price | $29.99 | $29.99 | $19.99 | $12.99 | $59.99 | $39.99 |
| Wholesale price | $18.00 | $18.00 | $10.00 | $6.50 | $32.00 | $21.00 |
| Manufacturing cost | $7.50 | $4.50 | $2.50 | $1.20 | $9.00 | $6.30 |
| Freight + duty | $0.00 | $1.18 | $1.35 | $0.56 | $5.20 | $5.18 |
| Packaging | $1.50 | $1.20 | $1.00 | $0.40 | $1.50 | $1.00 |
| **Landed cost** | **$9.00** | **$6.88** | **$4.85** | **$2.16** | **$15.70** | **$12.48** |
| Gross margin | 70% | 77% | 76% | 83% | 74% | 69% |
| **Contribution, own site (shipped)** | $7.92 (26%) | $10.04 (33%) | $5.16 (26%) | $3.63 (28%) | **$18.45 (31%)** | $6.55 (16%) |
| **Contribution, Amazon FBA** | $5.59 (19%) | $7.72 (26%) | $3.94 (20%) | $2.46 (19%) | **$11.99 (20%)** | $4.31 (11%) |
| Contribution, wholesale | $8.48 (47%) | $10.60 (59%) | $4.86 | $4.15 | $15.37 | $7.91 |
| **Contribution, local DFW hand-delivery** | **$18.92 (63%)** | $21.04 | $13.66 | $9.63 | $37.45 | $24.05 |

**Contribution** = price minus landed cost, shipping, payment fees, return allowance and marketing allowance.

**What this tells us:**
1. **Gross margin flatters everything.** All products show about 70–83% gross margin. After shipping, fees, returns and ads, it falls to about 11–33%. Never quote gross margin as profit.
2. **Local sales are where a $300 business makes money:** about 63% contribution on the Care Kit, versus 19% on Amazon.
3. **The pet cargo liner earns the most per order on every channel.** The constraint is the MOQ cash, not the economics.
4. **The trunk organizer is the weakest per order** once 42.6% China duty and bulky shipping are counted.
5. **The pet-hair tool and brush kit lose money as standalone products at scale.** Sell them only as add-ons or inside kits.

## 2. Break-even
- **Validation phase** (fixed costs about $3/month for the domain): break-even is **1 order per month** on any product.
- **At 50 orders/month**, fixed costs rise to about $95 (Shopify Basic plus Amazon Pro plus apps). Break-even is **12 Care Kit orders or 6 liner orders.**
- **At 500 orders/month** (about $1,650 fixed, including insurance, bookkeeping and part-time help): break-even is 242 Care Kits, 185 overseas Care Kits, or 112 liners.

## 3. Scenarios (portfolio path, `Scenarios` tab, section F)
The product mix shifts by stage. Early orders are 100% Care Kit from U.S. wholesale. By 1,000 orders/month the mix is 25% overseas Care Kit, 40% pet liner, 15% organizer, and 20% add-ons.

| Orders / month | 10 | 25 | 50 | 100 | 500 | 1,000 |
|---|---|---|---|---|---|---|
| Revenue / month | $300 | $666 | $1,450 | $3,611 | $18,770 | $37,052 |
| Contribution / month | $145 | $289 | $453 | $1,101 | $4,960 | $9,709 |
| Fixed costs / month | $3 | $3 | $95 | $175 | $1,650 | $4,200 |
| **Operating profit / month (pre-tax)** | **$142** | **$286** | **$358** | **$926** | **$3,310** | **$5,509** |
| Contribution margin | 48% | 43% | 31% | 30% | 26% | 26% |
| **Inventory cash needed on hand** | $90 | $226 | $772 | $2,787 | $15,438 | $31,718 |

**The single most important finding:** inventory needs grow faster than monthly profit. At 500 orders/month we need about $15k of stock but earn about $3.3k a month. **Growth will be limited by cash, not demand.** That is why the reinvestment rule (below) and supplier terms (trial orders, deposits under 30%, eventually net terms) matter as much as marketing.

## 4. Reinvestment rule (section G)
Of each month's positive operating profit:

| Share | Use |
|---|---|
| **50%** | Inventory and reorders |
| **15%** | Marketing tests |
| **15%** | New-product samples and development (pet liner samples first, then flagship patterns) |
| **15%** | Cash reserve, until it equals 3 months of fixed costs plus one reorder |
| **5%** | Founder draw |

**Milestone gates for reinvestment:**
| Gate | Trigger | Unlocks |
|---|---|---|
| G1 | 25 Care Kit orders in a month, two months running | File DBA→LLC decision; trademark filing (~$350/class, founder approval) |
| G2 | ≈$3,000 cumulative reinvestable cash | First pet-liner order (300 MOQ) or negotiated trial order |
| G3 | 100 orders/month for 3 months | Amazon Brand Registry, overseas Care Kit order, product liability insurance |
| G4 | 500 orders/month | Flagship cargo-system prototyping with a U.S. sewer; first wholesale/dealer program |
| G5 | 1,000 orders/month | Fitment database investment, second product family, first proprietary tooling evaluation |

## 5. How to update the model
1. Replace yellow inputs as RFQ answers arrive (product cost, freight, duty, FBA fee).
2. Run the Amazon Revenue Calculator with real sample dimensions and enter the FBA fee.
3. Update the channel mix in `Scenarios` with actual sales data monthly.
4. Re-score the `Opportunity Matrix` after interviews.
