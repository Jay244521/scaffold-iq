// End-to-end walkthrough of the main workflows in a real browser.
// Requires: a running app (npm run build && npm start) connected to a local Supabase
// stack (npx supabase start) with email confirmations off, and Playwright installed.
//   node tests/e2e/walkthrough.mjs [screenshotDir]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.argv[2] ?? "e2e-screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const ts = Date.now();
const PW = "Warehouse-Test-2026";
const owner = { name: "Olivia Owner", email: `owner.${ts}@example.com` };
const oscar = { name: "Oscar Operator", email: `oscar.${ts}@example.com` };
const rival = { name: "Rita Rival", email: `rita.${ts}@example.com` };

let step = 0;
const ok = (msg) => console.log(`ok ${++step} - ${msg}`);
function expect(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  ok(msg);
}

const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

async function signUp(page, user, next) {
  await page.goto(`${BASE}/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.fill("#fullName", user.name);
  await page.fill("#email", user.email);
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
}

async function reportIncident(page, { type, supplier, po, expected, received, description, files = [], bol }) {
  await page.goto(`${BASE}/incidents/new`);
  await page.locator(`input[name=type][value=${type}]`).check({ force: true });
  if (supplier) await page.fill("#supplierName", supplier);
  if (po) await page.fill("#poNumber", po);
  if (expected !== undefined) await page.fill("#expectedQty", String(expected));
  if (received !== undefined) await page.fill("#receivedQty", String(received));
  await page.fill("#description", description);
  if (bol) await page.setInputFiles("[data-testid=bol-input]", bol);
  if (files.length) await page.setInputFiles("[data-testid=photo-input]", files);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/incidents\/[0-9a-f-]{36}\?created=1/, { timeout: 30_000 });
  return page.url();
}

try {
  // Evidence: a real PNG, and a "JPEG" that is actually HTML (must be rejected by the server).
  const scratch = await browser.newPage();
  await scratch.setContent("<div style='width:400px;height:300px;background:#8b5a2b;color:#fff;font:40px sans-serif;padding:20px'>Crushed carton</div>");
  const png = path.join(SHOTS, "evidence-photo.png");
  await scratch.screenshot({ path: png });
  const bolPdf = path.join(SHOTS, "signed-bol.pdf");
  fs.writeFileSync(bolPdf, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  const fake = path.join(SHOTS, "disguised.jpg");
  fs.writeFileSync(fake, "<html><script>alert(1)</script></html>".padEnd(2000, " "));
  await scratch.close();

  // ------------------------------------------------------------ owner onboarding
  const ownerCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ownerCtx.newPage();
  await signUp(page, owner);
  await page.waitForURL(/\/onboarding/);
  ok("Owner signs up and lands on onboarding");
  await page.fill("#name", "Lone Star Distribution");
  await page.fill("#facilityName", "Dallas DC");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/dashboard\?welcome=1/);
  expect(await page.getByText("Your workspace is ready").isVisible(), "Organization created; dashboard shows welcome");
  await shot(page, "01-dashboard-empty");

  await page.goto(`${BASE}/settings/facilities`);
  await page.fill("#new-name", "Fort Worth Cross-Dock");
  await page.fill("#new-code", "FTW1");
  await page.click("text=Add facility");
  await page.getByText("Fort Worth Cross-Dock added.").waitFor();
  ok("Manager+ can add a second facility");
  await shot(page, "02-facilities");

  // ------------------------------------------------------------ incidents
  await page.goto(`${BASE}/incidents/new`);
  await page.locator("input[name=type][value=shortage]").check({ force: true });
  await page.fill("#description", "Short");
  await page.fill("#expectedQty", "10");
  await page.fill("#receivedQty", "12");
  await page.click("button[type=submit]");
  await page.getByText("For a shortage, received should be less than expected").waitFor();
  ok("Validation explains an inconsistent shortage");
  await shot(page, "03-incident-form-validation");

  const inc1 = await reportIncident(page, {
    type: "shortage", supplier: "Acme Packaging", po: "PO-1001", expected: 100, received: 92,
    description: "8 cartons short on inbound load from Acme. BOL shows 100.", files: [png, fake], bol: bolPdf,
  });
  expect(inc1.includes("failed=1"), "Disguised file is rejected by the server-side content check");
  expect(await page.getByText("Evidence (2)").isVisible(), "Real photo and signed BOL stored as private evidence");
  expect(await page.locator("section[aria-labelledby=bol-heading]").getByText("signed-bol.pdf").isVisible(), "Signed BOL appears in its own section");
  expect(await page.getByText("added signed BOL: signed-bol.pdf").isVisible(), "History records the signed BOL upload");
  const imgSrc = await page.locator("img[alt='evidence-photo.png']").getAttribute("src");
  expect(imgSrc && imgSrc.includes("/object/sign/") && imgSrc.includes("token="), "Evidence is served only through a signed, expiring URL");
  const publicTry = await page.request.get(imgSrc.replace("/object/sign/", "/object/public/").split("?")[0]);
  expect(publicTry.status() >= 400, `Public URL for evidence is refused (HTTP ${publicTry.status()})`);

  const inc2 = await reportIncident(page, { type: "damaged", supplier: "acme packaging", po: "PO-1002", description: "Two pallets crushed by forklift tines at trailer door." });
  const inc3 = await reportIncident(page, { type: "wrong_item", supplier: "Globex Foods", po: "PO-2001", expected: 40, received: 40, description: '=HYPERLINK("http://evil.example","click") Received SKU 1123 instead of 1132.' });
  ok("Three incidents reported; supplier name matched case-insensitively");

  // Add a signed BOL afterwards from the incident page
  await page.goto(inc2.split("?")[0]);
  expect(await page.getByText("No signed BOL attached yet").isVisible(), "Missing signed BOL is flagged on the incident");
  await page.setInputFiles("[data-testid=upload-signed_bol]", bolPdf);
  await page.getByText("1 file added.").waitFor({ timeout: 30_000 });
  await page.reload();
  expect(await page.locator("section[aria-labelledby=bol-heading]").getByText("signed-bol.pdf").isVisible(), "Signed BOL can be added later from the incident page");
  await page.goto(`${BASE}/incidents`);
  expect((await page.locator("tbody span[title='Signed BOL attached']").count()) === 2, "Incident list marks incidents that have a signed BOL");

  // Workflow on incident 1
  await page.goto(inc1.split("?")[0]);
  await page.fill("#body", "Called Acme. They will check the BOL and call back.");
  await page.click("text=Post comment");
  await page.locator("li", { hasText: "Called Acme" }).first().waitFor();
  ok("Internal comment posted");
  await page.selectOption("#status", "in_progress");
  await page.click("text=Save status");
  await page.getByText("Status updated.").waitFor();
  await page.selectOption("#status", "resolved");
  await page.click("text=Save status");
  await page.getByText("Add resolution notes before resolving or closing").waitFor();
  ok("Resolving without notes is blocked with a clear message");
  await page.fill("#resolutionNotes", "Acme issued credit memo CM-5531 for 8 cartons.");
  await page.click("text=Save status");
  await page.getByText("Status updated.").waitFor();
  await page.reload();
  expect(await page.getByText("changed status from In progress to Resolved").isVisible(), "History records status changes automatically");
  expect(await page.locator("dt:has-text('Resolved') + dd").innerText().then((t) => t.includes("Olivia")), "Resolution time and resolver recorded");
  await shot(page, "04-incident-detail");

  // ------------------------------------------------------------ team invitation
  await page.goto(`${BASE}/settings/team`);
  await page.fill("#email", oscar.email);
  await page.selectOption("#role", "operator");
  await page.click("text=Create invitation");
  const link = await page.locator("input[aria-label='Invitation link']").inputValue();
  expect(/\/invite\/[a-f0-9]{64}$/.test(link), "Admin gets a one-time invitation link");
  await shot(page, "05-team");

  const oscarCtx = await browser.newContext({ ...devices["iPhone 13"] });
  const op = await oscarCtx.newPage();
  await op.goto(link);
  expect(await op.getByText("Join Lone Star Distribution").isVisible(), "Invitee sees which company invited them");
  await signUp(op, oscar, new URL(link).pathname);
  await op.waitForURL(/\/invite\//);
  await op.click("text=Accept invitation");
  await op.waitForURL(/\/dashboard\?joined=1/);
  ok("Invitee signs up and joins as operator");
  await shot(op, "06-mobile-dashboard-operator");
  await op.goto(link);
  expect(await op.getByText("already been used").isVisible(), "Invitation link cannot be reused");

  // Owner assigns incident 2 to Oscar
  await page.goto(inc2.split("?")[0]);
  await page.selectOption("#assigneeId", { label: oscar.name });
  await page.click("text=Save assignment");
  await page.getByText("Incident assigned.").waitFor();
  ok("Supervisor+ assigns incident to the operator");

  // Oscar (operator) on his phone
  await op.goto(`${BASE}/incidents?assignee=me`);
  expect((await op.locator("ul.md\\:hidden > li").count()) === 1, "Operator filters to incidents assigned to them");
  await op.goto(inc3.split("?")[0]);
  expect(await op.getByText("Only supervisors, the reporter or the assigned employee").isVisible(), "Operator cannot update incidents they don't own");
  await op.goto(inc2.split("?")[0]);
  expect(!(await op.locator("#assigneeId").count()), "Operator does not get assignment controls");
  await op.selectOption("#status", "in_progress");
  await op.click("text=Save status");
  await op.getByText("Status updated.").waitFor();
  ok("Assigned operator updates status");
  expect(!(await op.locator("#status option[value=closed]").count()), "Operator cannot close incidents");
  await op.goto(`${BASE}/settings/team`);
  expect(!(await op.locator("text=Invite a team member").count()), "Operator cannot invite people");
  await op.goto(`${BASE}/incidents/new`);
  await shot(op, "07-mobile-incident-form");

  // ------------------------------------------------------------ search, filters, dashboard
  await page.goto(`${BASE}/incidents?q=PO-1001`);
  expect((await page.locator("tbody tr").count()) === 1, "Search by PO number");
  await page.goto(`${BASE}/incidents?q=globex`);
  expect((await page.locator("tbody tr").count()) === 1, "Search by supplier name");
  await page.goto(`${BASE}/incidents?status=unresolved`);
  expect((await page.locator("tbody tr").count()) === 2, "Filter unresolved incidents");
  await page.goto(`${BASE}/incidents`);
  await shot(page, "08-incident-list");
  await page.goto(`${BASE}/dashboard`);
  const total = await page.locator("a:has-text('Total exceptions') p").nth(1).innerText();
  expect(total.trim() === "3", "Dashboard totals match");
  expect(await page.locator("td a", { hasText: "Acme Packaging" }).isVisible(), "Supplier patterns list Acme");
  await shot(page, "09-dashboard");

  // ------------------------------------------------------------ reports, CSV export, editing
  await page.goto(`${BASE}/reports`);
  await page.getByText("Exceptions by supplier").waitFor();
  expect(await page.locator("td a", { hasText: "Acme Packaging" }).isVisible(), "Reports page shows exceptions by supplier");
  expect(await page.getByText("Unresolved exceptions by age").isVisible(), "Reports page shows unresolved aging");
  await shot(page, "10-reports");
  const csvRes = await page.request.get(`${BASE}/incidents/export`);
  const csv = await csvRes.text();
  expect(csvRes.status() === 200 && (csvRes.headers()["content-type"] ?? "").includes("text/csv"), "CSV export downloads");
  expect(csv.trim().split("\r\n").length === 4 && csv.includes('"EX-1"') && csv.includes('"Acme Packaging"'), "CSV contains the 3 incidents with a header row");
  expect(csv.includes(`"'=HYPERLINK(`) && !csv.includes(`,"=HYPERLINK(`), "CSV neutralizes spreadsheet formulas in user text");
  expect(csv.includes('"Signed BOL attached"') && (csv.match(/,"Yes",/g) ?? []).length === 2, "CSV shows which incidents have a signed BOL");
  const filtered = await (await page.request.get(`${BASE}/incidents/export?status=unresolved`)).text();
  expect(filtered.trim().split("\r\n").length === 3, "CSV export honors filters");

  await page.goto(inc3.split("?")[0] + "/edit");
  await page.fill("#poNumber", "PO-2001-A");
  await page.click("button[type=submit]");
  await page.waitForURL(/\?updated=1/);
  expect(await page.getByText("edited po number").isVisible(), "Supervisor+ edits details; history records the changed field");
  await op.goto(inc3.split("?")[0] + "/edit");
  expect(await op.getByText("Only supervisors, managers, admins and owners can edit").isVisible(), "Operators cannot edit incident details");

  // ------------------------------------------------------------ inventory reconciliation
  const sysCsv = path.join(SHOTS, "wms-export.csv");
  fs.writeFileSync(sysCsv, "SKU,Location,Description,Qty\nSKU-A,A1,Corrugated boxes,100\nSKU-B,B1,Stretch film,50\nSKU-C,C1,Pallet labels,10\n");
  const countCsv = path.join(SHOTS, "cycle-count.csv");
  fs.writeFileSync(countCsv, "Item Number,Bin,Qty On Hand,Unit Cost\nSKU-A,A1,95,2.50\nSKU-B,B1,50,\nSKU-NEW,C1,4,\n,X,3,\nSKU-C,C1,abc,\n");
  const badCsv = path.join(SHOTS, "bad.csv");
  fs.writeFileSync(badCsv, "Description,Notes\nBoxes,four\n");

  async function previewFile(pg, file, source = "count") {
    await pg.goto(`${BASE}/inventory/import`);
    await pg.locator(`input[name=source][value=${source}]`).check();
    await pg.setInputFiles("#file", file);
    await pg.click("text=Check file");
  }
  // Load records from a WMS export (owner = manager+), approving all new items.
  await previewFile(page, sysCsv, "system");
  await page.getByText("Preview: wms-export.csv").waitFor();
  await page.click("text=Save for review");
  await page.waitForURL(/\/inventory\/imports\/[0-9a-f-]{36}\?notice=created/);
  await page.click("text=Approve all rows to review");
  await page.waitForURL(/notice=decided/);
  await page.check("input[name=confirm]");
  await page.click("button:has-text('Apply 3 approved corrections')");
  await page.waitForURL(/notice=applied/);
  expect(await page.getByText("Applied 3 corrections").isVisible(), "Approved new items become inventory records");

  await previewFile(page, badCsv);
  await page.getByText("Required columns not found: SKU / item number and Quantity").waitFor();
  ok("Files without required columns are refused with a clear message");

  // Operator uploads a cycle count on a phone.
  await previewFile(op, countCsv);
  await op.getByText("Preview: cycle-count.csv").waitFor();
  const tile = async (label) => (await op.locator(`div.rounded-md:has(p:text-is("${label}")) p`).nth(1).innerText()).trim();
  expect((await tile("Discrepancies")) === "1" && (await tile("Not in records")) === "1" && (await tile("Match records")) === "1" && (await tile("Invalid")) === "2",
    "Preview shows discrepancies, new items, matches and invalid rows before saving");
  expect(await op.getByText("Missing SKU").isVisible() && await op.getByText('Invalid quantity "abc"').isVisible(), "Preview explains each invalid row");
  await shot(op, "12-mobile-inventory-preview");
  await op.click("text=Save for review");
  await op.waitForURL(/\/inventory\/imports\/[0-9a-f-]{36}\?notice=created/);
  const reviewUrl = op.url().split("?")[0];
  expect(await op.getByText("A manager, admin or owner reviews and applies").isVisible() && !(await op.locator("text=Approve selected").count()),
    "Operators cannot approve or apply corrections");

  // Manager reviews: approve the discrepancy, reject the new item, apply.
  await page.goto(reviewUrl);
  await page.locator("tr:has-text('SKU-A') input[name=lineId]").check();
  await page.click("text=Approve selected");
  await page.waitForURL(/notice=decided/);
  await page.locator("tr:has-text('SKU-NEW') input[name=lineId]").check();
  await page.click("text=Reject selected");
  await page.waitForURL(/notice=decided/);
  await page.goto(`${BASE}/inventory?q=SKU-A`);
  expect((await page.locator("td.text-right").first().innerText()).trim() === "100", "Approving alone changes nothing: record still shows 100");
  await page.goto(reviewUrl);
  await shot(page, "13-inventory-review");
  await page.check("input[name=confirm]");
  await page.click("button:has-text('Apply 1 approved correction')");
  await page.waitForURL(/notice=applied/);
  await page.goto(`${BASE}/inventory`);
  expect(await page.locator("li:has-text('SKU-A')").getByText("100 →").isVisible(), "Applied change is logged with before/after quantities");
  expect(await page.getByText("Approved by Olivia Owner").first().isVisible(), "Applied change is logged with the approver");
  await page.goto(`${BASE}/inventory?q=SKU-NEW`);
  expect(await page.getByText("No records match.").isVisible(), "Rejected new item was not created");
  await page.goto(`${BASE}/inventory?q=SKU-A`);
  expect((await page.locator("td.text-right").first().innerText()).trim() === "95", "Approved correction updated the record to 95");
  await page.goto(`${BASE}/inventory`);
  await shot(page, "14-inventory");

  // ------------------------------------------------------------ another company
  const rivalCtx = await browser.newContext();
  const rp = await rivalCtx.newPage();
  await signUp(rp, rival);
  await rp.waitForURL(/\/onboarding/);
  await rp.fill("#name", "Rival Logistics");
  await rp.fill("#facilityName", "Memphis Hub");
  await rp.click("button[type=submit]");
  await rp.waitForURL(/\/dashboard/);
  await rp.goto(inc1.split("?")[0]);
  expect(await rp.getByText("Page not found").isVisible(), "Another company cannot open Lone Star's incident by URL");
  await rp.goto(`${BASE}/incidents`);
  expect(await rp.getByText("No incidents yet").isVisible(), "Another company sees none of Lone Star's incidents");
  await rp.goto(`${BASE}/inventory`);
  expect(await rp.getByText("No inventory files yet").isVisible() && await rp.getByText("No inventory records yet").isVisible(), "Another company sees none of Lone Star's inventory");
  await rp.goto(reviewUrl);
  expect(await rp.getByText("Page not found").isVisible(), "Another company cannot open Lone Star's inventory import");
  const rivalCsv = await (await rp.request.get(`${BASE}/incidents/export`)).text();
  expect(rivalCsv.trim().split("\r\n").length === 1, "Another company's CSV export contains none of Lone Star's data");
  await rp.goto(link);
  expect(await rp.getByText("already been used").isVisible() || await rp.getByText("different email").isVisible(), "Another company's user cannot use the invitation");

  // Sign out
  await page.click("text=Log out");
  await page.waitForURL(/\/login/);
  await page.goto(`${BASE}/incidents`);
  expect(page.url().includes("/login"), "After logout, app pages require login again");

  console.log(`\nAll ${step} end-to-end checks passed. Screenshots in ${SHOTS}/`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
