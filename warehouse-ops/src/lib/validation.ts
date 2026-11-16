import { z } from "zod";
import { EXCEPTION_TYPES, STATUSES } from "@/lib/labels";
import { ROLES } from "@/lib/permissions";

/** Turns FormData into a plain object of trimmed strings; empty fields become undefined. */
export function formToObject(fd: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION")) continue;
    const t = v.trim();
    out[k] = t === "" ? undefined : t;
  }
  return out;
}

export type FieldErrors = Record<string, string[] | undefined>;
export type ActionState = { error?: string; fieldErrors?: FieldErrors; success?: string };

export function fieldErrorsOf(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

const text = (max: number, label: string) =>
  z.string().max(max, `${label} must be ${max} characters or fewer`);
const optionalText = (max: number, label: string) => text(max, label).optional();
const uuid = (label: string) => z.uuid(`Choose a valid ${label}`);

export const emailSchema = z.email("Enter a valid email address").max(254).transform((e) => e.toLowerCase());
const password = z
  .string({ error: "Enter a password" })
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer");

export const signupSchema = z.object({
  fullName: z.string({ error: "Enter your name" }).min(1, "Enter your name").max(120),
  email: emailSchema,
  password,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password").max(72),
});

export const resetRequestSchema = z.object({ email: emailSchema });
export const newPasswordSchema = z
  .object({ password, confirm: z.string({ error: "Confirm your password" }) })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export const organizationSchema = z.object({
  name: z.string({ error: "Enter your company name" }).min(2, "Company name must be at least 2 characters").max(120),
  facilityName: z.string().min(2, "Facility name must be at least 2 characters").max(120).optional(),
});

export const facilitySchema = z.object({
  name: z.string({ error: "Enter a facility name" }).min(2, "Facility name must be at least 2 characters").max(120),
  code: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,16}$/, "Code may only use letters, numbers, - and _ (16 max)")
    .optional(),
  address: optionalText(300, "Address"),
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(ROLES.filter((r) => r !== "owner") as ["viewer", ...string[]], { error: "Choose a role" }),
});

export const roleChangeSchema = z.object({
  userId: uuid("team member"),
  role: z.enum(ROLES, { error: "Choose a role" }),
});

const quantity = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return null;
    const n = Number(v.replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 99_999_999_999) {
      ctx.addIssue({ code: "custom", message: "Enter a quantity of 0 or more" });
      return z.NEVER;
    }
    return Math.round(n * 1000) / 1000;
  });

export const incidentSchema = z
  .object({
    facilityId: uuid("facility"),
    type: z.enum(EXCEPTION_TYPES, { error: "Choose the type of exception" }),
    supplierName: optionalText(160, "Supplier"),
    poNumber: optionalText(64, "PO number"),
    shipmentRef: optionalText(64, "Shipment reference"),
    sku: optionalText(64, "SKU"),
    itemDescription: optionalText(300, "Item description"),
    expectedQty: quantity,
    receivedQty: quantity,
    description: z.string({ error: "Describe what happened" }).min(1, "Describe what happened").max(5000),
    occurredAt: z.iso.datetime({ offset: true, error: "Enter when it happened" }),
  })
  .superRefine((v, ctx) => {
    const when = Date.parse(v.occurredAt);
    if (when > Date.now() + 10 * 60_000) {
      ctx.addIssue({ code: "custom", path: ["occurredAt"], message: "Date and time can't be in the future" });
    }
    if (when < Date.now() - 2 * 365 * 86_400_000) {
      ctx.addIssue({ code: "custom", path: ["occurredAt"], message: "Date must be within the last two years" });
    }
    if (v.expectedQty !== null && v.receivedQty !== null) {
      if (v.type === "shortage" && v.receivedQty >= v.expectedQty) {
        ctx.addIssue({ code: "custom", path: ["receivedQty"], message: "For a shortage, received should be less than expected" });
      }
      if (v.type === "overage" && v.receivedQty <= v.expectedQty) {
        ctx.addIssue({ code: "custom", path: ["receivedQty"], message: "For an overage, received should be more than expected" });
      }
    }
    if ((v.type === "shortage" || v.type === "overage") && (v.expectedQty === null || v.receivedQty === null)) {
      ctx.addIssue({ code: "custom", path: ["expectedQty"], message: "Enter both expected and received quantities" });
    }
  });

export const statusSchema = z
  .object({
    status: z.enum(STATUSES, { error: "Choose a status" }),
    resolutionNotes: optionalText(5000, "Resolution notes"),
  })
  .refine((v) => !(v.status === "resolved" || v.status === "closed") || Boolean(v.resolutionNotes), {
    message: "Add resolution notes before resolving or closing",
    path: ["resolutionNotes"],
  });

export const assignSchema = z.object({ assigneeId: uuid("team member").optional() });

export const commentSchema = z.object({
  body: z.string({ error: "Write a comment" }).min(1, "Write a comment").max(4000, "Comments must be 4,000 characters or fewer"),
});

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

/** Incident list filters from the URL. Invalid values are dropped, never trusted. */
export const incidentFilterSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  status: z.enum([...STATUSES, "unresolved", "done"]).optional().catch(undefined),
  type: z.enum(EXCEPTION_TYPES).optional().catch(undefined),
  facility: z.uuid().optional().catch(undefined),
  supplier: z.uuid().optional().catch(undefined),
  assignee: z.union([z.literal("me"), z.literal("unassigned"), z.uuid()]).optional().catch(undefined),
  from: dateOnly,
  to: dateOnly,
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});
export type IncidentFilters = z.infer<typeof incidentFilterSchema>;

/** Removes characters that have meaning in PostgREST filter syntax. */
export const sanitizeSearch = (q: string) => q.replace(/[,()*%\\:"'.]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
