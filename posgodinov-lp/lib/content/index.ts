import { brandContent } from "./brand";
import { headerContent, footerContent } from "./navigation";
import { heroContent, finalCtaContent } from "./hero";
import { trustBarContent, problemContent } from "./problem";
import { pillarsContent } from "./pillars";
import { featureBentoContent } from "./features";
import {
  syncEducationContent,
  cashIntegrityContent,
  testimonialContent,
} from "./sync";
import { pricingContent } from "./pricing";
import { faqContent } from "./faq";

export * from "./types";
export * from "./brand";
export * from "./navigation";
export * from "./hero";
export * from "./problem";
export * from "./pillars";
export * from "./features";
export * from "./sync";
export * from "./pricing";
export * from "./faq";

export const siteContent = {
  brand: brandContent,
  header: headerContent,
  hero: heroContent,
  trustBar: trustBarContent,
  problem: problemContent,
  pillars: pillarsContent,
  featureBento: featureBentoContent,
  syncEducation: syncEducationContent,
  cashIntegrity: cashIntegrityContent,
  testimonials: testimonialContent,
  pricing: pricingContent,
  faq: faqContent,
  finalCta: finalCtaContent,
  footer: footerContent,
} as const;
