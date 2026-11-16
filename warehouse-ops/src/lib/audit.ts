/** Plain-English descriptions of audit log entries (written by database triggers). */
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export type AuditEntry = {
  id: number;
  actor_id: string | null;
  action: "insert" | "update" | "delete";
  entity_type: string;
  entity_id: string | null;
  details: { old?: Record<string, unknown>; new?: Record<string, unknown> };
  created_at: string;
};

const role = (r: unknown) => ROLE_LABELS[r as Role] ?? String(r ?? "");
const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const changed = (o: Record<string, unknown> = {}, n: Record<string, unknown> = {}, ignore: string[] = []) =>
  Object.keys({ ...o, ...n }).filter((k) => !ignore.includes(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]));

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  memberships: "Team members",
  invitations: "Invitations",
  facilities: "Facilities",
  organizations: "Organization",
  suppliers: "Suppliers",
  incidents: "Deleted incidents",
  inventory_items: "Inventory records",
  inventory_imports: "Inventory imports",
};

export function describeAudit(e: AuditEntry, nameOf: (userId: string | null) => string): string {
  const o = e.details.old ?? {};
  const n = e.details.new ?? {};
  const v = { ...o, ...n };
  switch (e.entity_type) {
    case "memberships":
      if (e.action === "insert") return e.actor_id && e.actor_id === v.user_id ? `joined as ${role(n.role)}` : `added ${nameOf(v.user_id as string)} as ${role(n.role)}`;
      if (e.action === "delete") return `removed ${nameOf(v.user_id as string)} (${role(o.role)})`;
      return `changed ${nameOf(v.user_id as string)}'s role from ${role(o.role)} to ${role(n.role)}`;
    case "invitations":
      if (e.action === "insert") return `invited ${fmt(n.email)} as ${role(n.role)}`;
      if (n.accepted_at && !o.accepted_at) return `${fmt(n.email)} accepted the invitation`;
      if (n.revoked_at && !o.revoked_at) return `revoked the invitation for ${fmt(v.email)}`;
      return `updated the invitation for ${fmt(v.email)}`;
    case "facilities":
      if (e.action === "insert") return `added facility ${fmt(n.name)}`;
      if (e.action === "delete") return `deleted facility ${fmt(o.name)}`;
      if (o.is_active !== n.is_active) return `${n.is_active ? "reactivated" : "deactivated"} facility ${fmt(n.name)}`;
      if (o.name !== n.name) return `renamed facility ${fmt(o.name)} to ${fmt(n.name)}`;
      return `updated facility ${fmt(n.name)} (${changed(o, n, ["updated_at"]).join(", ") || "no visible change"})`;
    case "organizations":
      if (e.action === "insert") return `created the organization ${fmt(n.name)}`;
      if (o.name !== n.name) return `renamed the organization from ${fmt(o.name)} to ${fmt(n.name)}`;
      return "updated organization settings";
    case "suppliers":
      if (e.action === "delete") return `removed supplier ${fmt(o.name)} (merged or deleted)`;
      if (o.name !== n.name) return `renamed supplier ${fmt(o.name)} to ${fmt(n.name)}`;
      return `updated supplier ${fmt(n.name)}`;
    case "incidents":
      return `deleted incident EX-${fmt(o.number)}`;
    case "inventory_items":
      if (e.action === "insert") return `created inventory record ${fmt(n.sku)}${n.location ? ` @ ${n.location}` : ""} with ${fmt(n.on_hand)} on hand`;
      if (e.action === "delete") return `deleted inventory record ${fmt(o.sku)}`;
      return `changed ${fmt(n.sku)}${n.location ? ` @ ${n.location}` : ""} on hand from ${fmt(o.on_hand)} to ${fmt(n.on_hand)}`;
    case "inventory_imports":
      if (e.action === "insert") return `uploaded inventory file ${fmt(n.file_name)}`;
      if (o.status !== n.status) return `${n.status === "applied" ? "applied" : n.status === "discarded" ? "discarded" : "updated"} inventory file ${fmt(n.file_name)}${n.status === "applied" ? ` (${fmt(n.applied_rows)} corrections)` : ""}`;
      return `updated inventory file ${fmt(n.file_name)}`;
    default:
      return `${e.action} ${e.entity_type}`;
  }
}
