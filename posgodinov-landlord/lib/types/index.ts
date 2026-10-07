export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    [key: string]: unknown;
  };
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error?: string;
  details?: Record<string, unknown>;
  code?: string;
}

export interface LandlordUser {
  id: string;
  name: string;
  email: string;
  role: "SUPERADMIN" | "FINANCE" | "SUPPORT" | string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface LandlordLoginResponse {
  access_token: string;
  user: LandlordUser;
}

export interface LandlordMetricsOverview {
  total_businesses: number;
  active_businesses: number;
  suspended_businesses: number;
  businesses_by_plan: Record<string, number>;
  estimated_mrr_minor: number;
}

export interface BusinessWithSubscription {
  id: string;
  serial_business: string;
  email: string;
  name: string;
  owner_name: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  subscription_status: "ACTIVE" | "TRIAL" | "PAST_DUE" | "EXPIRED" | "SUSPENDED" | string;
  subscription_expires_at?: string;
  created_at: string;
}

export interface SaaSFeature {
  key: string;
  name: string;
  description: string;
  category: "CORE" | "INVENTORY" | "STAFF" | "REPORTS" | "INTEGRATION" | string;
  value_type: "NUMERIC_LIMIT" | "BOOLEAN_FLAG" | string;
  unit?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PlanFeature {
  id: string;
  plan_id: string;
  feature_key: string;
  is_enabled: boolean;
  limit_value: number; // -1 = Unlimited
  extra_config?: Record<string, unknown>;
  updated_at: string;
  feature?: SaaSFeature;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  price_minor: number;
  billing_cycle: "MONTHLY" | "YEARLY" | string;
  is_public: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  features?: PlanFeature[];
}

export interface TenantFeatureOverride {
  id: string;
  business_id: string;
  feature_key: string;
  override_type: "ADD_LIMIT" | "SET_LIMIT" | "ENABLE_FLAG" | "DISABLE_FLAG" | string;
  value_bool?: boolean;
  value_numeric?: number;
  notes?: string;
  expires_at?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan_id: string;
  status: string;
  started_at: string;
  expires_at?: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
  plan?: Plan;
}

export interface MerchantWallet {
  id: string;
  business_id: string;
  balance_minor: number;
  held_balance_minor: number;
  updated_at: string;
}

export interface BusinessDetailResponse {
  business: {
    id: string;
    serial_business: string;
    email: string;
    name: string;
    owner_name: string;
    phone_number?: string;
    address?: string;
    status: string;
    created_at: string;
  };
  subscription?: Subscription;
  wallet?: MerchantWallet;
  overrides?: TenantFeatureOverride[];
  effective_policy?: {
    plan_code: string;
    boolean_feature: Record<string, boolean>;
    numeric_limit: Record<string, number>;
  };
}

export interface LandingPageSetting {
  key: string;
  value: Record<string, unknown>;
  description: string;
  updated_at: string;
  updated_by?: string;
}

export interface LandingHeroBanner {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  image_desktop_url: string;
  image_mobile_url?: string;
  primary_cta_text: string;
  primary_cta_url: string;
  secondary_cta_text?: string;
  secondary_cta_url?: string;
  starts_at: string;
  ends_at?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface LandingFAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface SaaSCampaign {
  id: string;
  title: string;
  subtitle?: string;
  format: "POPUP_MODAL" | "CAROUSEL_SLIDE" | "HEADER_BANNER" | string;
  placement: string;
  image_url: string;
  action_type: "INTERNAL_UPGRADE" | "EXTERNAL_URL" | "INFO_ONLY" | string;
  action_url?: string;
  action_label: string;
  target_tier: "FREE_ONLY" | "ALL" | string;
  priority: number;
  skip_delay_seconds: number;
  starts_at: string;
  ends_at?: string;
  is_active: boolean;
  impression_count: number;
  click_count: number;
  created_at: string;
}

export interface LandlordAuditLog {
  id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}
