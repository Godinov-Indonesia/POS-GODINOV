import { getLandingPageData, getMergedLandingContent } from "@/lib/api/landing";
import { AnnouncementBar } from "@/components/common/AnnouncementBar";
import { HeroSection } from "@/components/sections/HeroSection";
import { TrustBar } from "@/components/sections/TrustBar";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { FeatureBento } from "@/components/sections/FeatureBento";
import { PricingSection } from "@/components/sections/PricingSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCtaSection } from "@/components/sections/FinalCtaSection";

export const revalidate = 60;

export default async function HomePage() {
  const apiData = await getLandingPageData();
  const content = getMergedLandingContent(apiData);

  return (
    <>
      {content.announcement.isActive && (
        <AnnouncementBar text={content.announcement.text} />
      )}
      <HeroSection
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
        apkUrls={content.apkUrls}
      />
      <TrustBar />
      <ProblemSection />
      <FeatureBento />
      <PricingSection
        plans={content.pricing.plans}
        heading={content.pricing.heading}
        subheading={content.pricing.subheading}
      />
      <FaqSection
        items={content.faq.items}
        heading={content.faq.heading}
        subheading={content.faq.subheading}
      />
      <FinalCtaSection whatsappUrl={content.contacts.whatsappUrl} />
    </>
  );
}
