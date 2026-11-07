import { siteContent, type PricingPlan, type FaqItem } from "@/lib/content";

export interface ApiLandingBanner {
  id: string;
  title: string;
  subtitle: string;
  tagline?: string;
  image_desktop_url?: string;
  image_mobile_url?: string;
  primary_cta_text?: string;
  primary_cta_url?: string;
  secondary_cta_text?: string;
  secondary_cta_url?: string;
  is_active: boolean;
}

export interface ApiLandingFaq {
  id: string;
  question: string;
  answer: string;
  category?: string;
  sort_order?: number;
  is_active: boolean;
}

export interface ApiLandingAnnouncement {
  id: string;
  title?: string;
  message?: string;
  text?: string;
  action_label?: string;
  action_url?: string;
  is_active: boolean;
}

export interface ApiPlanFeature {
  id?: string;
  plan_id?: string;
  feature_key: string;
  is_enabled: boolean;
  limit_value: number;
}

export interface ApiPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  price_minor: number;
  billing_cycle: "MONTHLY" | "YEARLY" | "LIFETIME" | string;
  is_public: boolean;
  is_active: boolean;
  sort_order: number;
  features?: ApiPlanFeature[];
}

export interface ApiLandingSettings {
  hero_banner?: {
    tagline?: string;
    title?: string;
    subtitle?: string;
  };
  contacts?: {
    whatsapp?: string;
    email?: string;
  };
  announcement?: {
    text?: string;
    is_active?: boolean;
  };
  apk_pos_url?: string;
  apk_so_url?: string;
}

export interface ApiLandingPageResponse {
  code: number;
  message: string;
  data: {
    hero_banners?: ApiLandingBanner[];
    faqs?: ApiLandingFaq[];
    announcements?: ApiLandingAnnouncement[];
    plans?: ApiPlan[];
    settings?: ApiLandingSettings;
  };
}

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

/**
 * Mengambil data landing page publik dari backend dengan ISR caching (revalidate 60s).
 * Fallback aman ke null jika backend offline/tidak terjangkau.
 */
export async function getLandingPageData(): Promise<ApiLandingPageResponse["data"] | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${BACKEND_BASE_URL}/v1/public/landing-page`, {
      signal: controller.signal,
      next: {
        revalidate: 60,
        tags: ["landing-page"],
      },
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Landing API] Failed with status ${res.status}`);
      return null;
    }

    const json = (await res.json()) as ApiLandingPageResponse;
    return json?.data || null;
  } catch (error) {
    console.warn("[Landing API] Error fetching public landing page data:", error);
    return null;
  }
}

export interface MergedLandingContent {
  announcement: {
    isActive: boolean;
    text: string;
  };
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    ctaPrimary: { text: string; href: string };
    ctaSecondary: { text: string; href: string };
    microProof: readonly string[];
  };
  pricing: {
    heading: string;
    subheading: string;
    yearlyDiscountNote: string;
    plans: PricingPlan[];
  };
  faq: {
    heading: string;
    subheading: string;
    items: FaqItem[];
  };
  contacts: {
    phone: string;
    whatsapp: string;
    whatsappUrl: string;
    email: string;
  };
  apkUrls: {
    pos: string;
    so: string;
  };
}

/**
 * Menggabungkan static siteContent dengan live API data secara seamless.
 */
export function getMergedLandingContent(
  apiData: ApiLandingPageResponse["data"] | null
): MergedLandingContent {
  const base = siteContent;

  // 1. Announcement Bar
  const annSetting = apiData?.settings?.announcement;
  const activeAnnItem = apiData?.announcements?.find((a) => a.is_active);
  const annIsActive = Boolean(annSetting?.is_active ?? activeAnnItem?.is_active);
  const annText =
    annSetting?.text ||
    activeAnnItem?.text ||
    activeAnnItem?.message ||
    "";

  // 2. Hero Content
  const heroSetting = apiData?.settings?.hero_banner;
  const heroEyebrow = heroSetting?.tagline || base.hero.eyebrow;
  const heroHeadline = heroSetting?.title || base.hero.headline;
  const heroSubheadline = heroSetting?.subtitle || base.hero.subheadline;

  // 3. Contacts
  const contactsSetting = apiData?.settings?.contacts;
  const waNumber = contactsSetting?.whatsapp || base.brand.contacts.whatsapp;
  const cleanDigits = waNumber.replace(/[^0-9]/g, "");
  const waUrl = cleanDigits
    ? `https://wa.me/${cleanDigits}?text=Halo%20Godinov,%20saya%20ingin%20tanya%20tentang%20Godinov%20POS`
    : base.brand.contacts.whatsappUrl;
  const email = contactsSetting?.email || base.brand.contacts.email;

  // 4. Pricing Plans
  let plans: PricingPlan[] = [...base.pricing.plans];
  if (apiData?.plans && apiData.plans.length > 0) {
    const proMonthly = apiData.plans.find(
      (p) => p.code === "PRO" && p.billing_cycle === "MONTHLY"
    );
    const proYearly = apiData.plans.find(
      (p) => p.code === "PRO" && p.billing_cycle === "YEARLY"
    );

    plans = plans.map((plan) => {
      // Map live price for Pro / Bisnis tier
      if (plan.id === "bisnis") {
        const monthly = proMonthly ? Math.round(proMonthly.price_minor / 100) : plan.monthlyPrice;
        const yearlyPerMonth = proYearly
          ? Math.round(proYearly.price_minor / 100 / 12)
          : plan.yearlyPricePerMonth;

        return {
          ...plan,
          monthlyPrice: monthly,
          yearlyPricePerMonth: yearlyPerMonth,
          description: proMonthly?.description || plan.description,
        };
      }
      return plan;
    });
  }

  // 5. FAQs
  let faqItems: FaqItem[] = [...base.faq.items];
  if (apiData?.faqs && apiData.faqs.length > 0) {
    const activeFaqs = apiData.faqs
      .filter((f) => f.is_active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
      }));

    if (activeFaqs.length > 0) {
      faqItems = activeFaqs;
    }
  }

  return {
    announcement: {
      isActive: annIsActive && Boolean(annText.trim()),
      text: annText,
    },
    hero: {
      eyebrow: heroEyebrow,
      headline: heroHeadline,
      subheadline: heroSubheadline,
      ctaPrimary: base.hero.ctaPrimary,
      ctaSecondary: base.hero.ctaSecondary,
      microProof: base.hero.microProof,
    },
    pricing: {
      heading: base.pricing.heading,
      subheading: base.pricing.subheading,
      yearlyDiscountNote: base.pricing.yearlyDiscountNote,
      plans,
    },
    faq: {
      heading: base.faq.heading,
      subheading: base.faq.subheading,
      items: faqItems,
    },
    contacts: {
      phone: base.brand.contacts.phone,
      whatsapp: waNumber,
      whatsappUrl: waUrl,
      email,
    },
    apkUrls: {
      pos: apiData?.settings?.apk_pos_url || "",
      so: apiData?.settings?.apk_so_url || "",
    },
  };
}
