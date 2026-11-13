"""Builds the operating workbook for the aftermarket brand OS.
Every hardcoded number is an input (blue) with a basis note; every result is a formula."""
import csv, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter as L

OUT = sys.argv[1]
CSV_DIR = sys.argv[2]

F = "Arial"
BLUE = Font(name=F, color="0000FF")
BLACK = Font(name=F)
BOLD = Font(name=F, bold=True)
GREEN = Font(name=F, color="008000")
TITLE = Font(name=F, bold=True, size=14)
HDR_FILL = PatternFill("solid", fgColor="1F2A36")
HDR_FONT = Font(name=F, bold=True, color="FFFFFF")
KEY = PatternFill("solid", fgColor="FFFF00")
SUB = PatternFill("solid", fgColor="E8EDF2")
thin = Side(style="thin", color="C9D1D9")
BOX = Border(top=thin, bottom=thin, left=thin, right=thin)
USD = '$#,##0.00;($#,##0.00);"-"'
USD0 = '$#,##0;($#,##0);"-"'
PCT = '0.0%;(0.0%);"-"'
INT = '#,##0;(#,##0);"-"'
WRAP = Alignment(wrap_text=True, vertical="top")

wb = Workbook()

def hdr(ws, row, values, col=1):
    for i, v in enumerate(values):
        c = ws.cell(row=row, column=col + i, value=v)
        c.font, c.fill, c.alignment, c.border = HDR_FONT, HDR_FILL, Alignment(wrap_text=True, vertical="center"), BOX

def widths(ws, ws_widths):
    for i, w in enumerate(ws_widths, start=1):
        ws.column_dimensions[L(i)].width = w

# ---------------------------------------------------------------- README
ws = wb.active
ws.title = "README"
rows = [
    ("Aftermarket Brand OS - Operating Workbook", TITLE),
    ("Prepared 2026-11-13. Planning model only. Scenarios are not forecasts.", BLACK),
    ("", BLACK),
    ("How to read this workbook", BOLD),
    ("Blue text = an input you can change (prices, costs, fees, scores, weights).", BLUE),
    ("Black text = a formula. Do not overwrite.", BLACK),
    ("Green text = a formula that pulls from another sheet.", GREEN),
    ("Yellow fill = a key assumption that must be replaced with a real supplier quote or platform figure before any money is committed.", BLACK),
    ("", BLACK),
    ("Sheets", BOLD),
    ("Opportunity Matrix - 23 products scored 1-5 on 10 criteria; two weightings (Launch, Strategic) and a blended rank.", BLACK),
    ("Unit Economics - landed cost, gross margin and contribution margin per unit, by channel, for the shortlisted products.", BLACK),
    ("Scenarios - 10 / 25 / 50 / 100 / 500 / 1,000 orders per month: revenue, contribution, fixed costs, operating profit, inventory cash, reinvestment.", BLACK),
    ("Budget Tracker - the $300 validation budget. Nothing is spent until the founder approves the line.", BLACK),
    ("Supplier Database - 25 supplier leads with what is claimed, what is verified, and what still has to be asked.", BLACK),
    ("", BLACK),
    ("Evidence rules", BOLD),
    ("Every supplier price, MOQ and fee in this file is either (a) taken from a public listing found by web search on 2026-11-13, marked 'listing', or (b) an assumption, marked 'ASSUMPTION'. None is a quote. Replace them with written RFQ responses.", BLACK),
    ("Gross margin = price minus landed product cost. Contribution margin = price minus every variable cost (landed cost, shipping, fees, returns, marketing). Operating profit = contribution minus fixed costs. None of these is net profit after tax.", BLACK),
]
for i, (t, f) in enumerate(rows, start=1):
    c = ws.cell(row=i, column=1, value=t)
    c.font = f
    c.alignment = Alignment(wrap_text=True)
ws["A8"].fill = KEY
ws.column_dimensions["A"].width = 130

# ---------------------------------------------------------------- Opportunity Matrix
om = wb.create_sheet("Opportunity Matrix")
criteria = ["Demand evidence", "Capital fit / MOQ", "Unit margin potential", "Shipping & storage simplicity",
            "Low return / fitment risk", "Low liability / regulatory risk", "Differentiation potential",
            "Competitive room", "Bundle / ecosystem fit", "Proprietary path"]
launch_w = [15, 15, 15, 10, 10, 10, 10, 5, 5, 5]
strat_w = [25, 0, 20, 0, 5, 5, 20, 5, 5, 15]
om["A1"] = "Product Opportunity Matrix"; om["A1"].font = TITLE
om["A2"] = ("Score each criterion 1 (poor) to 5 (excellent). Higher always means better for us (e.g. 5 on 'Low liability' = very low risk). "
            "Launch weights reward what a $300 start needs; Strategic weights reward what builds a durable brand. Scores are analyst judgements "
            "based on the evidence column, not measured data.")
om["A2"].alignment = WRAP; om.merge_cells("A2:T2"); om.row_dimensions[2].height = 45
om["A4"] = "Launch weights (sum must be 100)"; om["A4"].font = BOLD
om["A5"] = "Strategic weights (sum must be 100)"; om["A5"].font = BOLD
om["A6"] = "Blend: share of Launch score in Overall"; om["A6"].font = BOLD
for j, (lw, sw) in enumerate(zip(launch_w, strat_w)):
    col = 4 + j
    om.cell(row=4, column=col, value=lw).font = BLUE
    om.cell(row=5, column=col, value=sw).font = BLUE
om["N4"] = "=SUM(D4:M4)"; om["N5"] = "=SUM(D5:M5)"
om["O4"] = '=IF(N4=100,"OK","Weights must sum to 100")'; om["O5"] = '=IF(N5=100,"OK","Weights must sum to 100")'
om["D6"] = 0.6; om["D6"].font = BLUE; om["D6"].number_format = PCT; om["D6"].fill = KEY
om["E6"] = "At $300 the launch lens dominates. Lower this as capital grows."
H = 8
hdr(om, H, ["#", "Product", "Product family"] + criteria +
    ["Launch score (/100)", "Strategic score (/100)", "Overall score", "Overall rank", "Evidence (see 01-research/sources.md)", "Key risk", "Verdict"])
products = [
    # name, family, scores x10, evidence, risk, verdict
    ("Microfiber detailing bundle", "Care", [5,5,3,5,5,5,2,1,5,2],
     "US wholesale 16x16 300gsm towels listed at $0.39-$0.49 by case, no minimum (Microfiber Wholesale). Retail benchmarks: Rag Company bundle $40 sale/$97 reg; Chemical Guys 12-pack $45 sale.",
     "Commoditised; thin Amazon margin at domestic cost.", "FIRST PRODUCT"),
    ("Pet-hair removal tool", "Pet / Care", [3,4,4,5,5,4,2,1,5,3],
     "Low-cost rubber/pumice tools are a common Amazon add-on; no reliable search-volume data gathered.",
     "Existing design patents on some tools - freedom-to-operate check needed.", "Add-on to first kit"),
    ("Detailing brush kit", "Care", [4,4,3,5,5,5,2,1,5,2],
     "Sold widely as add-on to towel kits; overseas OEM common.", "Commoditised.", "Add-on / bundle"),
    ("Bumper protection flap", "Pet / Cargo", [3,3,4,4,4,5,2,3,5,3],
     "Often integrated into cargo liners (e.g. Smartto listing) - pairs with pet liner.", "Weak as standalone.", "Build into pet liner"),
    ("Rear seat-back protector (kick mats)", "Protection", [4,4,3,4,4,5,2,1,4,2],
     "Flat, light, low-cost textile product; crowded at $15-$25 per pair (judgement).", "Price war.", "Stage 2 catalog"),
    ("Car trash bin", "Organisation", [4,4,2,4,5,5,2,1,4,2],
     "HOTOR most-recommended at ~$10-$18; many sub-$10 listings.", "Very low price points.", "Stage 2 catalog"),
    ("Back-seat pet hammock (added)", "Pet", [5,2,4,3,3,4,3,1,5,4],
     "Pet car seat covers offered OEM by Lisohome, Pamipet, Uwin (claimed). Heavily reviewed category.",
     "Fit across rear benches; side-airbag/seatbelt access.", "Pet line after liner"),
    ("Windshield sunshade", "Protection", [5,3,3,3,2,5,3,1,3,4],
     "DFW summers make this locally relevant (judgement). Custom-fit versions differentiate.", "Fitment returns; seasonal.", "Seasonal SKU"),
    ("Premium trunk organizer", "Organisation", [5,2,3,2,4,5,3,1,4,3],
     "FORTEM ~51k reviews, ~$30-$45; Drive Auto ~$40. Alibaba tier $6.90 (100+) to $5.30 (2000+). CBP rulings classify under 4202.92 at 17.6% MFN + 25% Sec. 301 from China.",
     "Bulky FBA fees; ~43% duty from China; entrenched leaders.", "Stage 2 (non-China source)"),
    ("Pet cargo liner", "Pet / Cargo", [4,2,4,2,2,4,4,2,5,5],
     "4Knines most-recommended; common complaints: low sides, Velcro/suction failures, sizing. Alibaba listings $7-$9.50; pet suppliers state MOQ ~300.",
     "Sizing returns; bulky; $2.7k+ first order.", "BACKUP PRODUCT"),
    ("Trunk cargo net (added)", "Organisation", [3,4,3,5,3,5,1,2,4,2],
     "Cheap, light; mostly vehicle-specific hooks.", "Fitment; commodity.", "Low priority"),
    ("Rear-seat organizer", "Organisation", [4,3,3,4,4,4,2,1,4,2],
     "Kids-oriented listings dominate.", "If marketed to children, CPSIA children's-product rules may apply.", "Stage 2"),
    ("Vehicle-specific console organizer", "Organisation", [3,2,4,4,2,5,3,3,3,4],
     "Exists mainly for Tesla/popular trucks.", "Per-model SKUs and fit risk.", "Later, per hero vehicle"),
    ("Complete SUV cargo protection system", "Pet / Cargo", [3,1,5,1,2,4,5,3,5,5],
     "Gap: no mainstream brand sells liner + flap + seat-back + organizer as one fitted system (judgement from competitor review).",
     "Needs fitment data and tooling-free patterns; high capital.", "FLAGSHIP (Stage 2-3)"),
    ("Seat-gap organizer", "Organisation", [4,4,2,4,3,5,2,1,3,2],
     "Drop Stop 73k+ reviews; Walmart listings $7-$17.", "Fit varies by seat; low price.", "Low priority"),
    ("Door-edge protection kit", "Protection", [3,4,3,5,3,4,1,2,3,2],
     "Low-cost adhesive strips.", "Paint-damage claims from adhesives.", "Low priority"),
    ("Seat-back storage system", "Organisation", [3,2,3,3,4,5,3,2,4,3],
     "Premium versions of rear-seat organizers.", "Overlaps rear-seat organizer.", "Stage 2"),
    ("Phone mounting system", "Electronics-adjacent", [5,3,3,5,2,2,2,1,2,3],
     "Huge demand; dominated by large electronics brands.", "Compatibility, falling-device claims, magnet/charging rules.", "Avoid for now"),
    ("Custom-fit floor & cargo liners", "Protection", [5,1,4,1,1,4,4,1,5,5],
     "WeatherTech ~$180, Husky ~$60-$135, 3D MAXpider ~$70-$160, TuxMat ~$318 (review-site prices). Requires per-vehicle tooling or scan data.",
     "Tooling and fitment data; entrenched leaders.", "Stage 3+ (proprietary)"),
    ("Cup-holder organizer", "Organisation", [2,4,2,5,4,5,1,2,2,2],
     "Low-ticket novelty.", "Low value.", "Avoid"),
    ("Door-sill protection kit", "Protection", [2,2,3,4,2,5,2,3,3,3],
     "Mostly vehicle-specific.", "Fitment.", "Avoid for now"),
    ("Windshield frost cover", "Protection", [2,3,3,3,3,5,2,1,2,2],
     "Weak fit for DFW climate (judgement).", "Seasonal; low local demand.", "Avoid for DFW launch"),
    ("Universal seat covers (added)", "Protection", [4,2,3,3,2,2,2,1,3,3],
     "Large category.", "Side-airbag deployment compatibility is a safety issue.", "Avoid"),
]
first = H + 1
for i, (name, fam, sc, ev, risk, verdict) in enumerate(products):
    r = first + i
    om.cell(row=r, column=1, value=i + 1)
    om.cell(row=r, column=2, value=name)
    om.cell(row=r, column=3, value=fam)
    for j, s in enumerate(sc):
        c = om.cell(row=r, column=4 + j, value=s); c.font = BLUE
    om.cell(row=r, column=14, value=f"=SUMPRODUCT(D{r}:M{r},$D$4:$M$4)/5").number_format = "0.0"
    om.cell(row=r, column=15, value=f"=SUMPRODUCT(D{r}:M{r},$D$5:$M$5)/5").number_format = "0.0"
    om.cell(row=r, column=16, value=f"=N{r}*$D$6+O{r}*(1-$D$6)").number_format = "0.0"
    om.cell(row=r, column=17, value=f"=RANK(P{r},$P${first}:$P${first+len(products)-1})")
    om.cell(row=r, column=18, value=ev).alignment = WRAP
    om.cell(row=r, column=19, value=risk).alignment = WRAP
    om.cell(row=r, column=20, value=verdict)
    for c in range(1, 21):
        om.cell(row=r, column=c).border = BOX
        if om.cell(row=r, column=c).font != BLUE:
            om.cell(row=r, column=c).font = BLUE if 4 <= c <= 13 else (BOLD if c == 20 else BLACK)
last_om = first + len(products) - 1
widths(om, [4, 34, 16] + [11] * 10 + [11, 11, 10, 9, 60, 38, 22])
om.row_dimensions[H].height = 60
om.freeze_panes = "D9"

# ---------------------------------------------------------------- Unit Economics
ue = wb.create_sheet("Unit Economics")
ue["A1"] = "Unit Economics per Order (1 unit per order)"; ue["A1"].font = TITLE
ue["A2"] = "All blue cells are inputs. Yellow = must be replaced by a written supplier quote or the Amazon Revenue Calculator before committing money."
prods = ["Microfiber Care Kit (US wholesale-sourced)", "Microfiber Care Kit (overseas, post-validation)",
         "Detailing brush kit", "Pet-hair removal tool", "Pet cargo liner w/ bumper flap", "Premium trunk organizer"]
hdr(ue, 4, ["Line item"] + prods + ["Basis / source"])
inputs = [
    # label, values, fmt, key?, basis
    ("Retail price - own channel / local", [29.99, 29.99, 19.99, 12.99, 59.99, 39.99], USD, False,
     "ASSUMPTION set against competitor retail: Rag Co bundle $40-$97, Chem Guys 12-pk $45-$72, FORTEM $30-$45, 4Knines premium tier."),
    ("Retail price - Amazon", [29.99, 29.99, 19.99, 12.99, 59.99, 39.99], USD, False, "Same as own channel (price parity)."),
    ("Wholesale price - B2B (dealer, detailer, shop)", [18.00, 18.00, 10.00, 6.50, 32.00, 21.00], USD, False,
     "ASSUMPTION: ~50-60% of retail, typical keystone-style wholesale."),
    ("Unit manufacturing / purchase cost", [7.50, 4.50, 2.50, 1.20, 9.00, 6.30], USD, True,
     "Kit (US): 6x16x16 300gsm @ ~$0.55 incl. freight (listing $0.39-$0.49/case) + 1 drying towel @ $2.50 ASSUMPTION + 2 glass towels @ $0.80 ASSUMPTION. Overseas kit, brushes, pet tool: ASSUMPTION. Liner: Alibaba listing $7-$9.50. Organizer: Alibaba tier $6.30 at 500-999 pcs."),
    ("Inbound freight per unit", [0.00, 0.60, 0.60, 0.20, 2.50, 2.50], USD, True,
     "ASSUMPTION. US kit freight is inside the $0.55 towel figure. Bulky items assume consolidated sea freight."),
    ("Import duty rate (% of product cost)", [0.0, 0.128, 0.30, 0.30, 0.30, 0.426], PCT, True,
     "Microfiber 6307.10.2030: 5.3% MFN + 7.5% Sec. 301 (CBP ruling, 2020). Organizer 4202.92: 17.6% MFN + 25% Sec. 301 (CBP rulings). Others: 30% placeholder. A secondary source reports an extra 12.5% Sec. 301 duty since Jul-2026 - UNVERIFIED; confirm with a customs broker."),
    ("Packaging, label & insert per unit", [1.50, 1.20, 1.00, 0.40, 1.50, 1.00], USD, False, "ASSUMPTION: kraft mailer box/poly bag, sticker, QR care card."),
    ("Seller-paid shipping & pick/pack (own channel)", [6.00, 6.00, 4.50, 4.00, 10.00, 10.50], USD, True,
     "ASSUMPTION: USPS Ground Advantage, avg zone, free-shipping offer. Set to 0 for local hand-delivery."),
    ("Payment processing %", [0.029] * 6, PCT, False, "Shopify Payments Basic online 2.9% + 30c (secondary sources); Square similar."),
    ("Payment processing fixed $", [0.30] * 6, USD, False, "As above."),
    ("Amazon referral fee %", [0.15] * 6, PCT, False,
     "Conservative 15%. One source lists Automotive at 12% - verify in Seller Central for each ASIN's category."),
    ("Amazon FBA fulfillment fee", [5.00, 5.00, 4.20, 3.60, 8.50, 8.20], USD, True,
     "ASSUMPTION by size tier, incl. 3.5% fuel surcharge (Apr-2026). Verify in Amazon Revenue Calculator."),
    ("Amazon other per-unit (inbound placement, storage)", [0.50, 0.50, 0.40, 0.30, 1.00, 1.00], USD, False, "ASSUMPTION."),
    ("Return allowance (% of price)", [0.03, 0.03, 0.03, 0.04, 0.08, 0.05], PCT, False,
     "ASSUMPTION. Liner higher because of vehicle-size fit returns."),
    ("Marketing allowance per order - own channel", [5.00, 5.00, 4.00, 2.00, 9.00, 7.00], USD, False, "ASSUMPTION: blended CAC target."),
    ("Marketing allowance per order - Amazon ads", [4.50, 4.50, 3.00, 2.00, 9.00, 6.00], USD, False, "ASSUMPTION: ~15% TACoS."),
    ("Months of inventory cover to hold", [1.0, 3.0, 3.0, 3.0, 3.0, 3.0], "0.0", False,
     "ASSUMPTION: domestic restock ~1 month; overseas lead time + sea freight ~3 months."),
]
row = 5
ref = {}
for label, vals, fmt, key, basis in inputs:
    ue.cell(row=row, column=1, value=label).font = BLACK
    for j, v in enumerate(vals):
        c = ue.cell(row=row, column=2 + j, value=v)
        c.font = BLUE; c.number_format = fmt; c.border = BOX
        if key:
            c.fill = KEY
    ue.cell(row=row, column=8, value=basis).alignment = WRAP
    ref[label] = row
    row += 1
R = lambda k: ref[k]
calc_start = row + 1
ue.cell(row=row, column=1, value="Calculated").font = BOLD
row += 1
calcs = [
    ("Duty $", "={c}%d*{c}%d" % (R("Unit manufacturing / purchase cost"), R("Import duty rate (% of product cost)")), USD),
    ("LANDED COST per unit", None, USD),
    ("--- Own channel (website / local) ---", "", None),
    ("Payment fees", None, USD),
    ("Return allowance $", None, USD),
    ("Gross profit (price - landed cost)", None, USD),
    ("Gross margin %", None, PCT),
    ("Contribution per order", None, USD),
    ("Contribution margin %", None, PCT),
    ("--- Amazon FBA ---", "", None),
    ("Amazon referral fee $", None, USD),
    ("Amazon return allowance $", None, USD),
    ("Amazon contribution per order", None, USD),
    ("Amazon contribution margin %", None, PCT),
    ("--- Wholesale (B2B, buyer collects or pays freight) ---", "", None),
    ("Wholesale contribution per unit", None, USD),
    ("Wholesale contribution margin %", None, PCT),
    ("--- Local hand-delivery (DFW, no shipping, no ad spend) ---", "", None),
    ("Local contribution per order", None, USD),
    ("Local contribution margin %", None, PCT),
    ("--- Capital ---", "", None),
    ("Inventory cash tied up per monthly order", None, USD),
]
crow = {}
for label, _, fmt in calcs:
    crow[label] = row; row += 1
def f(label, col):
    c = col
    g = lambda k: f"{c}{R(k)}"
    h = lambda k: f"{c}{crow[k]}"
    price, amz, whs = g("Retail price - own channel / local"), g("Retail price - Amazon"), g("Wholesale price - B2B (dealer, detailer, shop)")
    m = {
        "Duty $": f"={g('Unit manufacturing / purchase cost')}*{g('Import duty rate (% of product cost)')}",
        "LANDED COST per unit": f"={g('Unit manufacturing / purchase cost')}+{g('Inbound freight per unit')}+{h('Duty $')}+{g('Packaging, label & insert per unit')}",
        "Payment fees": f"={price}*{g('Payment processing %')}+{g('Payment processing fixed $')}",
        "Return allowance $": f"={price}*{g('Return allowance (% of price)')}",
        "Gross profit (price - landed cost)": f"={price}-{h('LANDED COST per unit')}",
        "Gross margin %": f"=IF({price}=0,0,{h('Gross profit (price - landed cost)')}/{price})",
        "Contribution per order": f"={price}-{h('LANDED COST per unit')}-{g('Seller-paid shipping & pick/pack (own channel)')}-{h('Payment fees')}-{h('Return allowance $')}-{g('Marketing allowance per order - own channel')}",
        "Contribution margin %": f"=IF({price}=0,0,{h('Contribution per order')}/{price})",
        "Amazon referral fee $": f"=MAX(0.3,{amz}*{g('Amazon referral fee %')})",
        "Amazon return allowance $": f"={amz}*{g('Return allowance (% of price)')}",
        "Amazon contribution per order": f"={amz}-{h('LANDED COST per unit')}-{h('Amazon referral fee $')}-{g('Amazon FBA fulfillment fee')}-{g('Amazon other per-unit (inbound placement, storage)')}-{h('Amazon return allowance $')}-{g('Marketing allowance per order - Amazon ads')}",
        "Amazon contribution margin %": f"=IF({amz}=0,0,{h('Amazon contribution per order')}/{amz})",
        "Wholesale contribution per unit": f"={whs}-{h('LANDED COST per unit')}-{whs}*{g('Payment processing %')}",
        "Wholesale contribution margin %": f"=IF({whs}=0,0,{h('Wholesale contribution per unit')}/{whs})",
        "Local contribution per order": f"={price}-{h('LANDED COST per unit')}-{h('Payment fees')}-{h('Return allowance $')}",
        "Local contribution margin %": f"=IF({price}=0,0,{h('Local contribution per order')}/{price})",
        "Inventory cash tied up per monthly order": f"={h('LANDED COST per unit')}*{g('Months of inventory cover to hold')}",
    }
    return m.get(label)
for label, _, fmt in calcs:
    r = crow[label]
    cl = ue.cell(row=r, column=1, value=label)
    if label.startswith("---"):
        cl.font = BOLD; cl.fill = SUB
        for j in range(2, 8): ue.cell(row=r, column=j).fill = SUB
        continue
    cl.font = BOLD if label.isupper() or "Contribution per" in label or "contribution per" in label else BLACK
    for j in range(6):
        col = L(2 + j)
        c = ue.cell(row=r, column=2 + j, value=f(label, col))
        c.number_format = fmt; c.border = BOX
widths(ue, [46] + [19] * 6 + [90])
ue.row_dimensions[4].height = 45
for r in range(5, row):
    ue.row_dimensions[r].height = 30 if ue.cell(row=r, column=8).value and len(str(ue.cell(row=r, column=8).value)) > 90 else 15
ue.freeze_panes = "B5"
UE_ROWS = crow

# ---------------------------------------------------------------- Scenarios
sc = wb.create_sheet("Scenarios")
sc["A1"] = "Volume Scenarios - not forecasts"; sc["A1"].font = TITLE
sc["A2"] = "Change channel mix, fixed costs and product mix (blue). Profit here is pre-tax operating profit, not net profit."
vols = [10, 25, 50, 100, 500, 1000]
hdr(sc, 4, ["Scenario input"] + [f"{v:,} orders/mo" for v in vols] + ["Basis"])
sin = [
    ("Orders per month", vols, INT, "Brief-specified scenarios."),
    ("Share own channel (website/social, shipped)", [0.40, 0.50, 0.50, 0.45, 0.35, 0.30], PCT, "ASSUMPTION."),
    ("Share local DFW hand-delivery", [0.60, 0.40, 0.10, 0.05, 0.00, 0.00], PCT, "ASSUMPTION: early sales are local (car meets, Marketplace, referrals)."),
    ("Share Amazon FBA", [0.00, 0.00, 0.30, 0.40, 0.50, 0.50], PCT, "ASSUMPTION: Amazon opens once trademark application is filed and ~40 units/mo justifies the $39.99 Pro plan."),
    ("Share wholesale (B2B)", [0.00, 0.10, 0.10, 0.10, 0.15, 0.20], PCT, "ASSUMPTION."),
    ("Fixed costs per month ($)", [3, 3, 95, 175, 1650, 4200], USD0,
     "ASSUMPTION. 10-25: domain only. 50: + Shopify Basic $39 + Amazon Pro $39.99 + apps. 100: + product liability insurance est. 500: + LLC, bookkeeping, part-time packer. 1,000: + part-time staff, storage, software."),
]
srow = {}
r = 5
for label, vals, fmt, basis in sin:
    sc.cell(row=r, column=1, value=label)
    for j, v in enumerate(vals):
        c = sc.cell(row=r, column=2 + j, value=v); c.font = BLUE; c.number_format = fmt; c.border = BOX
    sc.cell(row=r, column=8, value=basis).alignment = WRAP
    srow[label] = r; r += 1
sc.cell(row=r, column=1, value="Channel mix check (must be 100%)")
for j in range(6):
    col = L(2 + j)
    c = sc.cell(row=r, column=2 + j, value=f"=SUM({col}{srow['Share own channel (website/social, shipped)']}:{col}{srow['Share wholesale (B2B)']})")
    c.number_format = PCT
mixcheck = r
r += 2

ue_col = ["B", "C", "D", "E", "F", "G"]
def blended(pcol, scol):
    U = lambda k: f"'Unit Economics'!${pcol}${UE_ROWS[k]}"
    S = lambda k: f"{scol}${srow[k]}"
    return (f"({S('Share own channel (website/social, shipped)')}*{U('Contribution per order')}"
            f"+{S('Share local DFW hand-delivery')}*{U('Local contribution per order')}"
            f"+{S('Share Amazon FBA')}*{U('Amazon contribution per order')}"
            f"+{S('Share wholesale (B2B)')}*{U('Wholesale contribution per unit')})")
def blended_rev(pcol, scol):
    U = lambda k: f"'Unit Economics'!${pcol}${ref[k]}"
    S = lambda k: f"{scol}${srow[k]}"
    return (f"(({S('Share own channel (website/social, shipped)')}+{S('Share local DFW hand-delivery')})*{U('Retail price - own channel / local')}"
            f"+{S('Share Amazon FBA')}*{U('Retail price - Amazon')}+{S('Share wholesale (B2B)')}*{U('Wholesale price - B2B (dealer, detailer, shop)')})")

blocks = [("A. Monthly revenue if 100% of orders were this product ($)", "rev"),
          ("B. Monthly contribution if 100% of orders were this product ($)", "con"),
          ("C. Monthly operating profit after fixed costs ($)", "op"),
          ("D. Break-even orders per month at this scenario's mix and fixed costs", "be"),
          ("E. Inventory cash needed on hand ($)", "inv")]
orders_ref = lambda scol: f"{scol}${srow['Orders per month']}"
fixed_ref = lambda scol: f"{scol}${srow['Fixed costs per month ($)']}"
for title, kind in blocks:
    sc.cell(row=r, column=1, value=title).font = BOLD
    for j in range(1, 8): sc.cell(row=r, column=j).fill = SUB
    r += 1
    for p, pcol in zip(prods, ue_col):
        sc.cell(row=r, column=1, value=p).font = GREEN
        for j in range(6):
            scol = L(2 + j)
            if kind == "rev":
                fm = f"={orders_ref(scol)}*{blended_rev(pcol, scol)}"
            elif kind == "con":
                fm = f"={orders_ref(scol)}*{blended(pcol, scol)}"
            elif kind == "op":
                fm = f"={orders_ref(scol)}*{blended(pcol, scol)}-{fixed_ref(scol)}"
            elif kind == "be":
                fm = f'=IF({blended(pcol, scol)}<=0,"never",ROUNDUP({fixed_ref(scol)}/{blended(pcol, scol)},0))'
            else:
                fm = f"={orders_ref(scol)}*'Unit Economics'!${pcol}${UE_ROWS['Inventory cash tied up per monthly order']}"
            c = sc.cell(row=r, column=2 + j, value=fm)
            c.number_format = INT if kind == "be" else USD0
            c.border = BOX
        r += 1
    r += 1

# Portfolio path
sc.cell(row=r, column=1, value="F. Recommended portfolio path - product mix by stage (must sum to 100%)").font = BOLD
for j in range(1, 8): sc.cell(row=r, column=j).fill = SUB
r += 1
mix = [
    [1.00, 0.85, 0.50, 0.00, 0.00, 0.00],
    [0.00, 0.00, 0.20, 0.45, 0.30, 0.25],
    [0.00, 0.05, 0.10, 0.10, 0.10, 0.10],
    [0.00, 0.10, 0.10, 0.10, 0.10, 0.10],
    [0.00, 0.00, 0.10, 0.35, 0.40, 0.40],
    [0.00, 0.00, 0.00, 0.00, 0.10, 0.15],
]
mix_start = r
for i, p in enumerate(prods):
    sc.cell(row=r, column=1, value=p)
    for j in range(6):
        c = sc.cell(row=r, column=2 + j, value=mix[i][j]); c.font = BLUE; c.number_format = PCT; c.border = BOX
    r += 1
mix_end = r - 1
sc.cell(row=r, column=1, value="Mix check")
for j in range(6):
    col = L(2 + j)
    sc.cell(row=r, column=2 + j, value=f"=SUM({col}{mix_start}:{col}{mix_end})").number_format = PCT
r += 1
port = {}
def port_row(label, formula_fn, fmt=USD0, bold=False):
    global r
    sc.cell(row=r, column=1, value=label).font = BOLD if bold else BLACK
    for j in range(6):
        scol = L(2 + j)
        c = sc.cell(row=r, column=2 + j, value=formula_fn(scol)); c.number_format = fmt; c.border = BOX
        if bold: c.font = BOLD
    port[label] = r; r += 1
def sp(kind, scol):
    parts = []
    for i, pcol in enumerate(ue_col):
        w = f"{scol}${mix_start + i}"
        if kind == "con": parts.append(f"{w}*{blended(pcol, scol)}")
        if kind == "rev": parts.append(f"{w}*{blended_rev(pcol, scol)}")
        if kind == "inv": parts.append(f"{w}*'Unit Economics'!${pcol}${UE_ROWS['Inventory cash tied up per monthly order']}")
    return "+".join(parts)
port_row("Portfolio revenue ($/mo)", lambda s: f"={orders_ref(s)}*({sp('rev', s)})")
port_row("Portfolio contribution ($/mo)", lambda s: f"={orders_ref(s)}*({sp('con', s)})")
port_row("Fixed costs ($/mo)", lambda s: f"={fixed_ref(s)}")
port_row("Portfolio operating profit ($/mo, pre-tax)", lambda s: f"={s}{port['Portfolio contribution ($/mo)']}-{s}{port['Fixed costs ($/mo)']}", bold=True)
port_row("Contribution margin % of revenue", lambda s: f"=IF({s}{port['Portfolio revenue ($/mo)']}=0,0,{s}{port['Portfolio contribution ($/mo)']}/{s}{port['Portfolio revenue ($/mo)']})", fmt=PCT)
port_row("Inventory cash needed on hand ($)", lambda s: f"={orders_ref(s)}*({sp('inv', s)})")
port_row("Annualised operating profit ($)", lambda s: f"={s}{port['Portfolio operating profit ($/mo, pre-tax)']}*12")
r += 1
sc.cell(row=r, column=1, value="G. Reinvestment rule (share of positive monthly operating profit)").font = BOLD
for j in range(1, 8): sc.cell(row=r, column=j).fill = SUB
r += 1
rules = [("Inventory & reorders", 0.50), ("Marketing tests", 0.15), ("New product samples & development", 0.15),
         ("Cash reserve (until 3 months of fixed costs + 1 reorder)", 0.15), ("Founder draw", 0.05)]
rule_start = r
for name, pct in rules:
    sc.cell(row=r, column=1, value=name)
    c = sc.cell(row=r, column=8, value=pct); c.font = BLUE; c.number_format = PCT
    for j in range(6):
        s = L(2 + j)
        cc = sc.cell(row=r, column=2 + j, value=f"=MAX(0,{s}{port['Portfolio operating profit ($/mo, pre-tax)']})*$H{r}")
        cc.number_format = USD0; cc.border = BOX
    r += 1
sc.cell(row=r, column=1, value="Rule check (column H must sum to 100%)")
sc.cell(row=r, column=8, value=f"=SUM(H{rule_start}:H{r-1})").number_format = PCT
widths(sc, [62] + [16] * 6 + [70])
sc.freeze_panes = "B5"

# ---------------------------------------------------------------- Budget Tracker
bt = wb.create_sheet("Budget Tracker")
bt["A1"] = "$300 Validation Budget & Spending Tracker"; bt["A1"].font = TITLE
bt["A2"] = "NO line may be spent until the founder writes 'YES' and a date in the approval columns. The total cap is $300 and cannot be raised."
bt["A2"].font = Font(name=F, bold=True, color="C00000")
bt["B3"] = "Total cap"; bt["C3"] = 300; bt["C3"].font = BLUE; bt["C3"].number_format = USD0
hdr(bt, 5, ["#", "Line item", "Brief's original allocation", "Recommended allocation", "Founder approved? (YES/NO)",
            "Approval date", "Actual spent", "Vendor", "Receipt / order link", "Gate - spend only if...", "Remaining on line"])
lines = [
    ("Product samples - US microfiber wholesalers (2 suppliers)", 120, 40, "Samples requested in writing; supplier answered RFQ basics."),
    ("Product samples - 1 overseas microfiber factory (sample + courier)", None, 45, "Factory passes identity checks (business licence, video call)."),
    ("Validation micro-batch (12 kits) - only against paid pre-orders", None, 60, "At least 8 paid pre-orders or deposits collected."),
    ("Sample shipping (inbound)", 35, 0, "Folded into sample lines above to avoid double-counting."),
    ("Domain / online presence", 20, 15, "Name passed USPTO knockout + domain check."),
    ("Assumed name certificate (DBA) - county clerk", None, 25, "Name chosen; needed for a business bank account under the brand."),
    ("Product presentation (labels, insert cards, photo props)", 15, 20, "Sample approved."),
    ("Customer validation (interview thank-yous)", 10, 10, "Interview script ready."),
    ("Initial marketing experiment (local boosted post)", 25, 25, "Listing live and 5 organic sales proven."),
    ("Cash reserve", 75, 60, "Untouchable unless founder re-approves."),
]
for i, (name, orig, rec, gate) in enumerate(lines):
    rr = 6 + i
    bt.cell(row=rr, column=1, value=i + 1)
    bt.cell(row=rr, column=2, value=name)
    c = bt.cell(row=rr, column=3, value=orig if orig is not None else 0); c.font = BLUE; c.number_format = USD0
    c = bt.cell(row=rr, column=4, value=rec); c.font = BLUE; c.number_format = USD0
    c = bt.cell(row=rr, column=5, value="NO"); c.font = BLUE; c.fill = KEY
    bt.cell(row=rr, column=6).fill = KEY
    c = bt.cell(row=rr, column=7, value=0); c.font = BLUE; c.number_format = USD
    bt.cell(row=rr, column=10, value=gate).alignment = WRAP
    bt.cell(row=rr, column=11, value=f'=IF(E{rr}="YES",D{rr}-G{rr},0)').number_format = USD
    for cc in range(1, 12): bt.cell(row=rr, column=cc).border = BOX
end = 6 + len(lines) - 1
t = end + 1
bt.cell(row=t, column=2, value="TOTAL").font = BOLD
for col in "CDG":
    c = bt[f"{col}{t}"]; c.value = f"=SUM({col}6:{col}{end})"; c.font = BOLD; c.number_format = USD0 if col != "G" else USD
bt.cell(row=t + 1, column=2, value="Recommended plan within cap?")
bt.cell(row=t + 1, column=4, value=f'=IF(D{t}<=$C$3,"OK","OVER CAP")')
bt.cell(row=t + 2, column=2, value="Cash remaining of $300")
bt.cell(row=t + 2, column=7, value=f"=$C$3-G{t}").number_format = USD
bt.cell(row=t + 3, column=2, value="Spent on unapproved lines (must be $0)")
bt.cell(row=t + 3, column=7, value=f'=SUMIF(E6:E{end},"<>YES",G6:G{end})').number_format = USD
bt.cell(row=t + 5, column=2, value="Example of a filled line (format only - not a real purchase): 'YES' | 2026-11-20 | $38.50 | Supplier name | order #/link").font = Font(name=F, italic=True, color="808080")
bt.cell(row=t + 6, column=2, value="$0 items not in budget: Texas sales & use tax permit (free, Comptroller), EIN (free, IRS), business checking (choose a no-fee account), Square/eBay/Amazon Individual (no monthly fee).").alignment = WRAP
widths(bt, [4, 58, 14, 14, 14, 13, 13, 18, 22, 48, 14])
bt.row_dimensions[5].height = 45

# ---------------------------------------------------------------- Supplier Database
sd = wb.create_sheet("Supplier Database")
with open(f"{CSV_DIR}/supplier-database.csv", newline="", encoding="utf-8") as fh:
    data = list(csv.reader(fh))
sd["A1"] = "Supplier Candidates - leads, not vetted partners"; sd["A1"].font = TITLE
sd["A2"] = "Claims come from supplier websites/listings as surfaced by web search on 2026-11-13. Nothing here is a quote. 'Verification status' tracks what we have confirmed ourselves."
hdr(sd, 4, data[0])
for i, rowv in enumerate(data[1:]):
    for j, v in enumerate(rowv):
        c = sd.cell(row=5 + i, column=1 + j, value=v); c.alignment = WRAP; c.border = BOX; c.font = BLACK
sd_w = [5, 26, 28, 12, 18, 28, 26, 18, 16, 18, 22, 26, 26, 26, 50, 16, 50]
widths(sd, sd_w[:len(data[0])])
sd.freeze_panes = "C5"

wb.save(OUT)
print("saved", OUT)
