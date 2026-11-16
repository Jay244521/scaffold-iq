/**
 * Role permissions, mirrored from the database rules in supabase/migrations.
 * The UI uses these to show or hide controls and server actions check them first,
 * but PostgreSQL (RLS + triggers) is the final authority.
 */
export const ROLES = ["viewer", "operator", "supervisor", "manager", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  operator: "Operator",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control, including ownership and billing decisions.",
  admin: "Manages team members, invitations and all settings.",
  manager: "Manages facilities and suppliers, approves inventory corrections, plus everything a supervisor can do.",
  supervisor: "Assigns, edits, closes and reopens incidents.",
  operator: "Reports incidents, adds evidence and comments, updates incidents they own, uploads inventory counts.",
  viewer: "Read-only access to incidents and dashboards.",
};

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);

export const atLeast = (role: Role | null | undefined, min: Role) =>
  role != null && ROLES.indexOf(role) >= ROLES.indexOf(min);

export const can = {
  createIncident: (r: Role) => atLeast(r, "operator"),
  comment: (r: Role) => atLeast(r, "operator"),
  uploadEvidence: (r: Role) => atLeast(r, "operator"),
  assign: (r: Role) => atLeast(r, "supervisor"),
  editIncidentDetails: (r: Role) => atLeast(r, "supervisor"),
  closeIncident: (r: Role) => atLeast(r, "supervisor"),
  deleteEvidence: (r: Role) => atLeast(r, "supervisor"),
  manageFacilities: (r: Role) => atLeast(r, "manager"),
  manageTeam: (r: Role) => atLeast(r, "admin"),
  deleteFacility: (r: Role) => atLeast(r, "admin"),
  importInventory: (r: Role) => atLeast(r, "operator"),
  approveInventory: (r: Role) => atLeast(r, "manager"),
};

/** Whether this user may change the status / resolution of an incident. */
export function canUpdateIncident(
  role: Role,
  userId: string,
  incident: { reported_by: string | null; assigned_to: string | null },
) {
  if (atLeast(role, "supervisor")) return true;
  return atLeast(role, "operator") && (incident.assigned_to === userId || incident.reported_by === userId);
}

/** Roles an actor may grant to others (by invitation or role change). */
export function grantableRoles(actor: Role): Role[] {
  if (actor === "owner") return [...ROLES].reverse();
  if (actor === "admin") return ROLES.filter((r) => r !== "owner").reverse();
  return [];
}

/** Roles an invitation may carry (never owner). */
export const invitableRoles = (actor: Role): Role[] => grantableRoles(actor).filter((r) => r !== "owner");
