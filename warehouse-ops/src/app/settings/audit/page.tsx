import Link from "next/link";
import type { Metadata } from "next";
import { LocalTime } from "@/components/client";
import { Alert, Card, PageHeader, buttonClass, cx } from "@/components/ui";
import { AUDIT_ENTITY_LABELS, describeAudit, type AuditEntry } from "@/lib/audit";
import { getMembers, requireAppContext } from "@/lib/context";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const ctx = await requireAppContext();
  const sp = await searchParams;
  if (!can.manageTeam(ctx.org.role)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Audit log" />
        <Alert tone="info">Only owners and admins can view the audit log.</Alert>
      </div>
    );
  }
  const type = sp.type && sp.type in AUDIT_ENTITY_LABELS ? sp.type : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  let q = ctx.supabase
    .from("audit_log")
    .select("id, actor_id, action, entity_type, entity_id, details, created_at", { count: "exact" })
    .eq("org_id", ctx.org.orgId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (type) q = q.eq("entity_type", type);
  const [{ data, count }, members] = await Promise.all([q, getMembers(ctx.org.orgId)]);
  const entries = (data ?? []) as AuditEntry[];
  const nameOf = (u: string | null) => (u ? (members.find((m) => m.userId === u)?.name ?? "a former member") : "System");
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: Record<string, string | undefined>) =>
    `/settings/audit?${new URLSearchParams(Object.entries({ type, ...p }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Audit log"
        description="Every change to team members, invitations, facilities, suppliers and inventory records. Written automatically by the database; it can't be edited or deleted."
      />
      <nav className="flex flex-wrap gap-1 text-sm" aria-label="Filter audit log">
        {[["", "All"], ...Object.entries(AUDIT_ENTITY_LABELS)].map(([k, label]) => (
          <Link key={k || "all"} href={href({ type: k || undefined, page: undefined })} aria-current={(type ?? "") === k ? "true" : undefined}
            className={cx("rounded-md px-2.5 py-1", (type ?? "") === k ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100")}>
            {label}
          </Link>
        ))}
      </nav>
      <Card title={`${(count ?? 0).toLocaleString()} entr${count === 1 ? "y" : "ies"}`}>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing recorded yet.</p>
        ) : (
          <ol className="-my-2 divide-y divide-slate-100">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-baseline sm:gap-3">
                <span className="w-40 shrink-0 text-xs text-slate-500"><LocalTime value={e.created_at} /></span>
                <span className="text-slate-800">
                  <strong className="font-medium text-slate-900">{nameOf(e.actor_id)}</strong> {describeAudit(e, nameOf)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-slate-600">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className={buttonClass("secondary", "sm")}>Newer</Link>}
            {page < pages && <Link href={href({ page: String(page + 1) })} className={buttonClass("secondary", "sm")}>Older</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
