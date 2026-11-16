/**
 * Rules-based "suggested next steps" for a receiving exception (no AI).
 * Suggestions only: nothing here changes data or contacts anyone.
 */
import { formatQty, type ExceptionType, type IncidentStatus } from "@/lib/labels";

export type StepInput = {
  type: ExceptionType;
  status: IncidentStatus;
  supplierName: string | null;
  poNumber: string | null;
  shipmentRef: string | null;
  expectedQty: number | null;
  receivedQty: number | null;
  assignedTo: string | null;
  photoCount: number;
  bolCount: number;
  commentCount: number;
  ageDays: number;
};

export type Step = { key: string; text: string; priority: "high" | "normal" };

export function suggestNextSteps(i: StepInput): Step[] {
  if (i.status === "resolved" || i.status === "closed") return [];
  const steps: Step[] = [];
  const add = (key: string, text: string, priority: Step["priority"] = "normal") => steps.push({ key, text, priority });
  const supplier = i.supplierName ?? "the supplier";
  const diff = i.expectedQty !== null && i.receivedQty !== null ? Number(i.receivedQty) - Number(i.expectedQty) : null;

  // Evidence first: it's hardest to get later.
  if (i.bolCount === 0) add("bol", "Attach the signed BOL or delivery receipt. It's the proof of what was signed for at the dock.", "high");
  if (i.type === "damaged" && i.photoCount === 0) add("photos", "Photograph the damage: pallet label, each damaged carton and the trailer before unloading further.", "high");
  if (i.type !== "damaged" && i.photoCount === 0) add("photos-any", "Add a photo of the pallet label or packing list.");
  if (!i.supplierName) add("supplier", "Record the supplier so this counts toward supplier reports and patterns.");
  if (!i.poNumber && !i.shipmentRef) add("refs", "Add the PO or shipment / BOL number so the supplier can match their records.");
  if (!i.assignedTo) add("assign", "Assign a responsible employee so someone owns the follow-up.");

  switch (i.type) {
    case "shortage":
      add("recount", "Recount the received cartons and check other pallets on the load before contacting the supplier.");
      add("bol-notation", "Check whether the BOL was signed with the shortage noted. A clean signature weakens a claim.");
      add("claim", diff !== null && diff < 0
        ? `Request a credit or reship for ${formatQty(-diff)} unit${-diff === 1 ? "" : "s"} from ${supplier}.`
        : `Request a credit or reship for the missing units from ${supplier}.`);
      break;
    case "overage":
      add("quarantine-over", diff !== null && diff > 0
        ? `Hold the extra ${formatQty(diff)} unit${diff === 1 ? "" : "s"} separately; don't put them away until ${supplier} responds.`
        : "Hold the extra units separately until the supplier responds.");
      add("ask-over", `Ask ${supplier} whether to return the extra units, keep and invoice them, or hold them for pickup.`);
      break;
    case "damaged":
      add("quarantine-dmg", "Move damaged product to a quarantine area and label it with this incident number.");
      add("carrier-or-supplier", "Decide whether the damage happened in transit (carrier claim) or before shipping (supplier claim), and notify that party.");
      break;
    case "wrong_item":
      add("segregate", "Keep the wrong items separate and labeled so they aren't picked or put away.");
      add("rma", `Ask ${supplier} for the correct item and return instructions (RMA number).`);
      break;
    default:
      add("define", "Add a comment describing what's needed to resolve this.");
  }

  if (i.ageDays > 7) add("escalate", `Open for ${Math.floor(i.ageDays)} days. Escalate to a manager or follow up with ${supplier}.`, "high");
  else if (i.status === "open" && i.ageDays > 2 && i.commentCount === 0) add("update", "No updates for over 2 days. Add a comment with the current status.");

  return steps.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1));
}
