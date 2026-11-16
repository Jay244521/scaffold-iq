// Black-box security check of a deployed Supabase project through its public API,
// using the synthetic demo accounts (supabase/demo/synthetic-demo-data.sql).
// It signs in as real users and attempts cross-company reads/writes the way an attacker
// with a valid account could. Any test data it creates is removed at the end.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_KEY=sb_publishable_... DEMO_PASSWORD=... \
//     node tests/staging/api-isolation.mjs
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_KEY: key, DEMO_PASSWORD: pw } = process.env;
if (!url || !key || !pw) throw new Error("Set SUPABASE_URL, SUPABASE_KEY and DEMO_PASSWORD");

let n = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok ${++n} - ${msg}`);
};
async function as(email) {
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, uid: data.user.id };
}
const png = Buffer.from(
  "89504E470D0A1A0A0000000D4948445200000001000000010806000000" + "1F15C4890000000D4944415478DA63F8CFC0F01F0005000201E2B5E2" + "B30000000049454E44AE426082",
  "hex",
);

const dana = await as("dana.owner@example.com");
const rosa = await as("rosa.owner@example.com");
const tom = await as("tom.operator@example.com");
const grace = await as("grace.viewer@example.com");
const anon = createClient(url, key, { auth: { persistSession: false } });

const { data: orgA } = await dana.c.from("organizations").select("id").eq("name", "Lone Star Distribution (Demo)").single();
const { data: facA } = await dana.c.from("facilities").select("id").eq("org_id", orgA.id).limit(1).single();
const { data: incA } = await dana.c.from("incidents").select("id").eq("org_id", orgA.id).limit(1).single();
const { count: countA } = await dana.c.from("incidents").select("id", { count: "exact", head: true });
ok(countA >= 48, `Owner of company A sees its ${countA} incidents`);

// ---- company B (Rosa) attacking company A
const { data: rosaRows } = await rosa.c.from("incidents").select("org_id");
ok(rosaRows.length === 2 && rosaRows.every((r) => r.org_id !== orgA.id), "Company B sees only its own 2 incidents");
ok((await rosa.c.from("incidents").select("id").eq("id", incA.id)).data.length === 0, "Company B cannot fetch a company A incident by id");
ok((await rosa.c.from("organizations").select("id").eq("id", orgA.id)).data.length === 0, "Company B cannot see company A");
ok((await rosa.c.from("profiles").select("id").eq("id", dana.uid)).data.length === 0, "Company B cannot see company A's people");
ok((await rosa.c.from("incident_comments").select("id").eq("org_id", orgA.id)).data.length === 0, "Company B cannot read company A comments");
ok((await rosa.c.from("incident_events").select("id").eq("org_id", orgA.id)).data.length === 0, "Company B cannot read company A history");
const ins = await rosa.c.from("incidents").insert({ org_id: orgA.id, facility_id: facA.id, type: "other", description: "x", occurred_at: new Date().toISOString() });
ok(Boolean(ins.error), "Company B cannot create an incident in company A");
const upd = await rosa.c.from("incidents").update({ description: "tampered" }).eq("id", incA.id).select("id");
ok(!upd.error && upd.data.length === 0, "Company B cannot modify a company A incident");
const del = await rosa.c.from("incidents").delete().eq("id", incA.id).select("id");
ok(!del.error && del.data.length === 0, "Company B cannot delete a company A incident");
const mem = await rosa.c.from("memberships").insert({ org_id: orgA.id, user_id: rosa.uid, role: "owner" });
ok(Boolean(mem.error), "Company B cannot add itself to company A");
const inv = await rosa.c.rpc("create_invitation", { p_org: orgA.id, p_email: "spy@example.com", p_role: "admin" });
ok(Boolean(inv.error), "Company B cannot create invitations for company A");
const sum = await rosa.c.rpc("incident_summary", { p_org: orgA.id });
ok(sum.data?.total === 0, "Company B gets an empty dashboard summary for company A");
const rep = await rosa.c.rpc("incident_report", { p_org: orgA.id });
ok(rep.data?.total === 0 && rep.data?.by_supplier.length === 0, "Company B gets an empty report for company A");
const up = await rosa.c.storage.from("incident-evidence").upload(`${orgA.id}/${incA.id}/x.png`, png, { contentType: "image/png" });
ok(Boolean(up.error), "Company B cannot upload files into company A's evidence");
const ls = await rosa.c.storage.from("incident-evidence").list(`${orgA.id}/${incA.id}`);
ok((ls.data ?? []).length === 0, "Company B cannot list company A's evidence");

// ---- inventory
const { count: invA } = await dana.c.from("inventory_items").select("id", { count: "exact", head: true });
ok(invA >= 24, `Company A sees its ${invA} inventory records`);
ok((await rosa.c.from("inventory_items").select("id").eq("org_id", orgA.id)).data.length === 0, "Company B cannot read company A inventory");
ok((await rosa.c.from("inventory_imports").select("id").eq("org_id", orgA.id)).data.length === 0, "Company B cannot read company A inventory imports");
const rImp = await rosa.c.rpc("create_inventory_import", { p_org: orgA.id, p_facility: facA.id, p_source: "count", p_file_name: "x.csv", p_lines: [{ line_no: 2, sku: "CB-1824", location: "A-01-01", qty: 1 }] });
ok(Boolean(rImp.error), "Company B cannot import inventory into company A");
const { data: pendingImp } = await dana.c.from("inventory_imports").select("id").eq("org_id", orgA.id).eq("status", "pending_review").limit(1).single();
ok(Boolean((await rosa.c.rpc("apply_inventory_import", { p_import: pendingImp.id })).error), "Company B cannot apply company A corrections");
ok(Boolean((await tom.c.rpc("apply_inventory_import", { p_import: pendingImp.id })).error), "Operators cannot apply inventory corrections");
const direct = await dana.c.from("inventory_items").update({ on_hand: 1 }).eq("org_id", orgA.id).select("id");
ok(Boolean(direct.error) || direct.data.length === 0, "Even the owner cannot change inventory quantities directly");

// ---- roles inside company A
const gi = await grace.c.from("incidents").insert({ org_id: orgA.id, facility_id: facA.id, type: "other", description: "x", occurred_at: new Date().toISOString() });
ok(Boolean(gi.error), "Viewer cannot create incidents");
const gu = await grace.c.from("incidents").update({ status: "closed", resolution_notes: "x" }).eq("id", incA.id).select("id");
ok(gu.data?.length === 0, "Viewer cannot change incidents");
const tomInc = await tom.c
  .from("incidents")
  .insert({ org_id: orgA.id, facility_id: facA.id, type: "damaged", description: "[automated security check — removed automatically]", occurred_at: new Date().toISOString(), reported_by: dana.uid, status: "closed" })
  .select("id, reported_by, status")
  .single();
ok(!tomInc.error && tomInc.data.reported_by === tom.uid && tomInc.data.status === "open", "Operator can report; reporter and status are forced server-side");
const path = `${orgA.id}/${tomInc.data.id}/check.png`;
ok(!(await tom.c.storage.from("incident-evidence").upload(path, png, { contentType: "image/png" })).error, "Operator can upload evidence to their incident");
const html = await tom.c.storage.from("incident-evidence").upload(`${orgA.id}/${tomInc.data.id}/x.html`, Buffer.from("<script>"), { contentType: "text/html" });
ok(Boolean(html.error), "Storage rejects disallowed file types (HTML)");
const pub = await fetch(`${url}/storage/v1/object/public/incident-evidence/${path}`);
ok(pub.status >= 400, `Evidence has no public URL (HTTP ${pub.status})`);
const ta = await tom.c.from("incidents").update({ assigned_to: tom.uid }).eq("id", tomInc.data.id).select("id");
ok(Boolean(ta.error), "Operator cannot assign incidents");

// ---- not signed in
const an = await anon.from("incidents").select("id").limit(1);
ok(Boolean(an.error), "Visitors who are not signed in cannot read incidents");

// ---- clean up (owner removes the check incident and its file)
await dana.c.storage.from("incident-evidence").remove([path]);
const cleanup = await dana.c.from("incidents").delete().eq("id", tomInc.data.id).select("id");
ok(cleanup.data?.length === 1, "Test data cleaned up");
console.log(`\nAll ${n} staging security checks passed.`);
