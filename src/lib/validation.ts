import { z } from "zod";

export const onboardingSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(120),
  websiteUrl: z.string().min(3, "Website URL is required").max(300),
  industry: z.string().max(120).optional().or(z.literal("")),
  primaryLocation: z.string().max(160).optional().or(z.literal("")),
  serviceArea: z.string().max(200).optional().or(z.literal("")),
  monthlyAdBudget: z.coerce.number().min(0).max(10_000_000).optional(),
  monthlyMarketingBudget: z.coerce.number().min(0).max(10_000_000).optional(),
  primaryConversionGoal: z.enum([
    "calls",
    "form_fills",
    "bookings",
    "purchases",
    "demo_requests",
    "newsletter_signup",
    "other",
  ]),
  averageCustomerValue: z.coerce.number().min(0).max(10_000_000).optional(),
  topServices: z.array(z.string().max(120)).max(15).default([]),
  profitableServices: z.array(z.string().max(120)).max(10).default([]),
  targetLocations: z.array(z.string().max(120)).max(20).default([]),
  competitors: z.array(z.string().max(160)).max(10).default([]),
  targetCustomer: z.string().max(500).optional().or(z.literal("")),
  adStatus: z.enum(["not_running", "running", "paused", "unknown"]),
  marketingStatus: z.enum(["none", "seo_only", "ppc_only", "both", "unknown"]).default("unknown"),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

const optNum = z.coerce.number().optional();
const optStr = z.string().max(300).optional();
const optBool = z.boolean().optional();

/** Permissive schema for user-entered analytics. Every field is optional. */
export const manualAnalyticsSchema = z.object({
  businessContext: z
    .object({
      runningGoogleAds: z.enum(["yes", "no", "paused", "unsure"]).optional(),
      doingSeo: z.enum(["yes", "no", "somewhat", "unsure"]).optional(),
      monthlyAdsBudget: optNum,
      monthlySeoBudget: optNum,
      averageCustomerValue: optNum,
      closeRate: optNum,
      mostImportantConversion: optStr,
      targetLocations: optStr,
      competitors: optStr,
    })
    .partial()
    .default({}),
  websiteMetrics: z
    .object({
      sessions: optNum,
      users: optNum,
      organicSessions: optNum,
      paidSessions: optNum,
      conversions: optNum,
      conversionRate: optNum,
      topLandingPageUrl: optStr,
      topLandingPageSessions: optNum,
      topLandingPageConversions: optNum,
      bounceOrEngagementRate: optNum,
      mostImportantEvent: optStr,
      formsTracked: optBool,
      phoneClicksTracked: optBool,
      bookingsOrPurchasesTracked: optBool,
      hasThankYouPages: optBool,
    })
    .partial()
    .default({}),
  ppcMetrics: z
    .object({
      monthlySpend: optNum,
      impressions: optNum,
      clicks: optNum,
      ctr: optNum,
      avgCpc: optNum,
      conversions: optNum,
      costPerConversion: optNum,
      conversionRate: optNum,
      topCampaign: optStr,
      topAdGroup: optStr,
      topKeyword: optStr,
      worstKeyword: optStr,
      brandedSeparated: optBool,
      servicesSeparated: optBool,
      negativeKeywordsUsed: optBool,
      adExtensionsUsed: optBool,
      trafficDestination: z.enum(["homepage", "dedicated", "mixed"]).optional(),
    })
    .partial()
    .default({}),
  seoMetrics: z
    .object({
      organicClicks: optNum,
      organicImpressions: optNum,
      organicCtr: optNum,
      averagePosition: optNum,
      topQuery: optStr,
      topPage: optStr,
      highImpressionLowClickQuery: optStr,
      highImpressionLowCtrPage: optStr,
      hasServicePages: optBool,
      hasLocationPages: optBool,
      hasBlog: optBool,
      hasGoogleBusinessProfile: optBool,
    })
    .partial()
    .default({}),
  trackingMetrics: z
    .object({
      analyticsInstalled: optBool,
      gtmInstalled: optBool,
      adsConversionTracking: optBool,
      phoneCallTracking: optBool,
      formTracking: optBool,
      bookingPurchaseTracking: optBool,
      duplicateConversionsPossible: optBool,
      knowsQualifiedLeadSources: optBool,
    })
    .partial()
    .default({}),
  knownIssues: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export const newAuditSchema = z.object({
  websiteUrl: z.string().min(3, "Website URL is required").max(300),
  businessId: z.string().optional(),
  // Inline business context (from the intake wizard) — used when no saved business.
  businessName: z.string().max(120).optional(),
  industry: z.string().max(120).optional(),
  primaryLocation: z.string().max(160).optional(),
  serviceArea: z.string().max(200).optional(),
  topServices: z.array(z.string().max(120)).max(15).optional(),
  profitableService: z.string().max(160).optional(),
  mode: z.enum(["url_only", "manual", "connected", "full"]),
  dateRange: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  primaryGoal: z
    .enum([
      "calls",
      "form_fills",
      "bookings",
      "purchases",
      "demo_requests",
      "newsletter_signup",
      "other",
    ])
    .optional(),
  notes: z.string().max(1000).optional(),
  demo: z.boolean().optional(),
  manualInput: manualAnalyticsSchema.optional(),
});
export type NewAuditInput = z.infer<typeof newAuditSchema>;

export function dateRangeToBounds(range: string, start?: string, end?: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (range === "custom" && start && end) return { dateStart: start, dateEnd: end };
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  return { dateStart: fmt(from), dateEnd: fmt(today) };
}
