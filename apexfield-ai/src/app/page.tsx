import { DemoModalProvider } from "@/components/landing/DemoModal";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemStatsBar } from "@/components/landing/ProblemStatsBar";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { RoiCalculator } from "@/components/landing/RoiCalculator";
import { FieldBuiltSection } from "@/components/landing/FieldBuiltSection";
import { PricingAndFaq } from "@/components/landing/PricingAndFaq";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <DemoModalProvider>
      <Navbar />
      <main>
        <HeroSection />
        <ProblemStatsBar />
        <HowItWorks />
        <RoiCalculator />
        <FieldBuiltSection />
        <PricingAndFaq />
      </main>
      <Footer />
    </DemoModalProvider>
  );
}
