import type { Metadata } from "next";
import { SessionHistory } from "@/components/dashboard/SessionHistory";

export const metadata: Metadata = { title: "Session history — ApexField AI" };

export default function HistoryPage() {
  return <SessionHistory />;
}
