import type { Metadata } from "next";
import { FleetDashboard } from "@/components/dashboard/FleetDashboard";

export const metadata: Metadata = {
  title: "Fleet Command Dashboard — ApexField AI",
  description:
    "Service manager command center: monitor every technician's live AI coaching session, catch safety holds and escalations, and push guidance to the tech's headset.",
};

export default function DashboardPage() {
  return <FleetDashboard />;
}
