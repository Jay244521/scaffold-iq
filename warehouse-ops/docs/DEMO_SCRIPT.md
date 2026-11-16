# Warehouse Ops: 15-minute demo script

For meetings with warehouse operators, distributors, manufacturers and 3PLs. Uses the **synthetic** demo
company. Everything shown is fictional, and nothing sends emails.

**Demo site:** https://web-production-059ef3bc.up.railway.app
Demo logins all use the same password (it's in your notes, not in this file):

| Login | Role | Use it to show |
|---|---|---|
| dana.owner@example.com | Owner | The full tour: dashboard, reports, settings, audit log |
| marcus.manager@example.com | Manager | Approving the pending inventory count |
| tom.operator@example.com | Operator | Fast incident entry on a phone |
| rosa.owner@example.com | Owner of a *different* company | That companies can't see each other's data |

## Before the meeting (5 minutes, the day before)
1. Open the demo site and log in as Dana. This wakes the site (it sleeps when idle) and keeps the free
   Supabase database from pausing (it pauses after about 7 days without use).
2. Check the dashboard shows exceptions and "Patterns to watch".
3. Have a phone ready, logged in as Tom (optionally added to the home screen: Share → Add to Home Screen).
4. Don't merge suppliers or apply the pending inventory count while rehearsing. Those can't be undone, and you'll
   want them for the live demo.

## The demo

### 1. The problem, in their words (2 min, no screen)
Ask before showing anything:
- "When a shipment arrives short or damaged, what happens next? Who writes it down, and where?"
- "How do you prove to a supplier what was actually signed for at the dock, three weeks later?"
- "How do you know which suppliers cause the most problems?"

Listen for: spreadsheets, email threads, photos on personal phones, lost BOLs, claims that miss deadlines.

### 2. Logging an exception at the dock (3 min, on the phone as Tom)
- **Report exception** → tap **Shortage** → pick a facility and supplier → enter PO, expected 100, received 92
  (the variance calculates itself) → short description.
- **Add signed BOL** (photo of the paperwork) and **Add photos or files** (damage, pallet label).
- Submit. Point out: it took under a minute, the time and the person are recorded automatically, and the
  photos are stored privately.

Talking point: *"The hard part is capturing the evidence at the moment it happens, not tracking it after."*

### 3. Working the exception (3 min, desktop as Dana)
- Open the new incident. Show **Suggested next steps** (recount, check the BOL notation, request credit for 8 units).
- **Assign** it to a supervisor, add an internal comment, change the status.
- Scroll to **Activity and comments**: every change is in the history automatically and can't be edited.
- Resolve it. Resolution notes are required, and the resolution time is recorded.

### 4. Seeing the patterns (3 min)
- **Dashboard:** open / in progress / resolved, average time to resolve, exceptions by category,
  **Patterns to watch** (e.g. a supplier whose wrong-item exceptions doubled this month).
- **Reports:** by supplier with a category breakdown, unresolved exceptions by age, date and facility filters,
  **Export CSV**.
- Click **Report** next to Trinity Corrugated. That's the **supplier discrepancy report**: a printable/PDF summary and
  a draft message you edit and send yourself. *"Nothing is ever sent to a supplier automatically."*

### 5. Inventory counts without overwrites (2 min, as Marcus)
- **Inventory** → open Tom's pending cycle count. Show the discrepancies, the dollar impact, and the invalid row
  with its reason.
- Approve one correction, reject another, tick the confirmation and **apply**. Show "Recent approved changes" with the
  approver's name. *"Nobody, not even an owner, can change a quantity without this approval step."*

### 6. Trust and control (2 min)
- **Settings → Team:** six roles (owner to viewer); invitations are single-use links tied to an email address.
- **Settings → Audit log:** every admin change, in plain English.
- Log in as **Rosa** (another company): her account sees none of Lone Star's data. Opening a Lone Star incident
  link gives "Page not found".

## Close (asks, not claims)
- "Which part of this would save your team the most time?"
- "What would you need to see to try it at one dock for 30 days?"
- "Who else is involved in deciding?"

## Be honest about
- This is an early product running on demo data. Don't describe pilots or customers that don't exist.
- Real users can't sign themselves up on the demo yet (it needs an email provider, pending your approval).
- It doesn't replace a WMS. It handles receiving exceptions and count reconciliation alongside one.
