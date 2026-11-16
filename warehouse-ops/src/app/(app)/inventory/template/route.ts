import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";

/** A blank-ish example file showing the expected columns. */
export function GET() {
  const csv = toCsv(
    ["SKU", "Location", "Description", "Qty", "Unit cost"],
    [
      ["CB-1824", "A-01-02", "18x24 corrugated boxes (bundle of 25)", 120, 18.5],
      ["RF-M8x30", "C-04-01", "M8 x 30 hex bolts, box of 500", 34, 41.25],
    ],
  );
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="inventory-template.csv"' },
  });
}
