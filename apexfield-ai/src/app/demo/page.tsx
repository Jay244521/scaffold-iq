import type { Metadata } from "next";
import { DemoModalProvider } from "@/components/landing/DemoModal";
import { DemoExperience } from "@/components/demo/DemoExperience";

export const metadata: Metadata = {
  title: "Interactive Field Demo — ApexField AI",
  description:
    "Run a live HVAC service call with Gemini watching your camera and coaching by voice, or try the guided browser simulator: scan the data plate, pass the safety gate, log readings against OEM spec, and get the dispatch report.",
};

export default function DemoPage() {
  return (
    <DemoModalProvider>
      <DemoExperience />
    </DemoModalProvider>
  );
}
