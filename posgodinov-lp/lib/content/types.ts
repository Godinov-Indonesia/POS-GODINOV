export interface NavItem {
  label: string;
  href: string;
}

export interface ProblemCard {
  id: number;
  title: string;
  body: string;
  impact: string;
}

export interface BentoItem {
  slug: string;
  title: string;
  description: string;
  spanDesktop: number;
  tone: "default" | "brand" | "signal";
  badge?: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPricePerMonth: number | null;
  highlighted?: boolean;
  outletLimit: string;
  deviceLimit: string;
  features: { name: string; included: boolean }[];
  ctaText: string;
  ctaHref: string;
  customPrice?: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface ContactInfo {
  phone: string;
  whatsapp: string;
  whatsappUrl: string;
  email: string;
  address: {
    street: string;
    locality: string;
    district: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  socials: {
    instagram: string;
    linkedin: string;
    tiktok: string;
  };
}
