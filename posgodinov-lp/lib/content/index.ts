import { brandContent } from "./brand";
import { headerContent, footerContent } from "./navigation";
import { heroContent, finalCtaContent } from "./hero";
import { trustBarContent, problemContent } from "./problem";
import { featureBentoContent } from "./features";
import { pricingContent } from "./pricing";
import { faqContent } from "./faq";

export * from "./types";
export * from "./brand";
export * from "./navigation";
export * from "./hero";
export * from "./problem";
export * from "./features";
export * from "./pricing";
export * from "./faq";

export const siteContent = {
  brand: brandContent,
  header: headerContent,
  hero: heroContent,
  trustBar: trustBarContent,
  problem: problemContent,
  featureBento: featureBentoContent,
  pricing: pricingContent,
  faq: faqContent,
  finalCta: finalCtaContent,
  footer: footerContent,
} as const;
