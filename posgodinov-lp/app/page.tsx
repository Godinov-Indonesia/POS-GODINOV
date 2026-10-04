import { HeroSection } from "@/components/sections/HeroSection";
import { TrustBar } from "@/components/sections/TrustBar";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { FeatureBento } from "@/components/sections/FeatureBento";
import { PricingSection } from "@/components/sections/PricingSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustBar />
      <ProblemSection />
      <FeatureBento />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
