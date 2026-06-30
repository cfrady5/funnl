/**
 * Domain types — the single source of truth for shapes shared across the
 * crawler, Google service wrappers, audit engine, and UI. These mirror the
 * Supabase schema in `supabase/migrations` but are the in-app representation
 * (camelCase, richer enums) used everywhere outside the DB layer.
 */

export type Severity = "critical" | "high" | "medium" | "low";
export type Difficulty = "easy" | "medium" | "hard";
/** url_only = crawl + SEO; connected = + Google data; full = the complete SEO + PPC audit. */
export type AuditMode = "url_only" | "connected" | "full";
export type AuditStatus = "pending" | "running" | "completed" | "failed";
export type Urgency = "now" | "soon" | "later";
export type Confidence = "high" | "medium" | "low";

export type ConversionGoal =
  | "calls"
  | "form_fills"
  | "bookings"
  | "purchases"
  | "demo_requests"
  | "newsletter_signup"
  | "other";

export type AdStatus = "not_running" | "running" | "paused" | "unknown";
export type MarketingStatus = "none" | "seo_only" | "ppc_only" | "both" | "unknown";

export type IntegrationProvider = "google_ads" | "ga4" | "search_console" | "gtm";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "expired";

export type RecommendationCategory =
  | "seo"
  | "technical_seo"
  | "content"
  | "local_seo"
  | "ai_search"
  | "ad_copy"
  | "landing_page"
  | "conversion_tracking"
  | "keyword_strategy"
  | "campaign_structure"
  | "budget_allocation"
  | "negative_keywords"
  | "bidding"
  | "measurement"
  | "organic_gap";

// --- User / business -------------------------------------------------------

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  userId: string;
  businessName: string;
  websiteUrl: string;
  industry: string | null;
  primaryLocation: string | null;
  serviceArea: string | null;
  monthlyAdBudget: number | null;
  monthlyMarketingBudget: number | null;
  primaryConversionGoal: ConversionGoal | null;
  averageCustomerValue: number | null;
  topServices: string[];
  profitableServices: string[];
  targetLocations: string[];
  competitors: string[];
  targetCustomer: string | null;
  adStatus: AdStatus;
  marketingStatus: MarketingStatus;
  createdAt: string;
  updatedAt: string;
}

// --- Integrations ----------------------------------------------------------

export interface GoogleIntegration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  scopes: string[];
  connectedAt: string | null;
  lastSyncAt: string | null;
  status: IntegrationStatus;
  // Tokens are never sent to the client; these are present only server-side.
  tokenExpiresAt?: string | null;
}

export interface SelectedGoogleAccounts {
  id: string;
  userId: string;
  businessId: string;
  googleAdsCustomerId: string | null;
  ga4PropertyId: string | null;
  searchConsoleSiteUrl: string | null;
  gtmAccountId: string | null;
  gtmContainerId: string | null;
  gtmWorkspaceId: string | null;
}

// --- Crawler ---------------------------------------------------------------

export type PageType =
  | "home"
  | "service"
  | "product"
  | "pricing"
  | "contact"
  | "booking"
  | "location"
  | "about"
  | "blog"
  | "other";

export interface CtaButton {
  text: string;
  href: string | null;
  type: "primary" | "link" | "form_submit";
}

export interface DetectedForm {
  action: string | null;
  fieldCount: number;
  fields: string[];
  hasSubmit: boolean;
}

export interface CrawledPage {
  id: string;
  auditId: string;
  url: string;
  statusCode: number | null;
  pageType: PageType;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  h1: string | null;
  h1Count: number;
  headings: { h2: string[]; h3: string[] };
  bodySummary: string | null;
  ctas: CtaButton[];
  forms: DetectedForm[];
  phoneLinks: string[];
  emailLinks: string[];
  internalLinks: string[];
  externalLinks: string[];
  imageCount: number;
  imagesMissingAlt: number;
  hasVideo: boolean;
  detectedServices: string[];
  detectedLocations: string[];
  trustSignals: string[];
  openGraph: boolean;
  schemaTypes: string[];
  lastUpdated: string | null;
  pageSpeedScore: number | null;
  mobileScore: number | null;
  wordCount: number;
  issues: string[];
  createdAt: string;
}

/** Site-wide signals captured once per crawl (not per page). */
export interface SiteSignals {
  https: boolean;
  robotsTxtPresent: boolean;
  robotsTxtBlocksAll: boolean;
  sitemapPresent: boolean;
  sitemapUrl: string | null;
  homepageStatus: number | null;
}

// --- Google Ads ------------------------------------------------------------

export interface GoogleAdsRow {
  customerId: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string | null;
  adGroupName: string | null;
  keywordText: string | null;
  searchTerm: string | null;
  matchType?: string | null;
  landingPageUrl: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  costMicros: number;
  conversions: number;
  conversionRate: number;
  costPerConversion: number;
  conversionValue?: number;
  qualityScore: number | null;
}

// --- GA4 -------------------------------------------------------------------

export interface Ga4Row {
  propertyId: string;
  pagePath: string;
  landingPage: string;
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  users: number;
  engagedSessions: number;
  conversions: number;
  eventCount: number;
  keyEvents: number;
  revenue: number;
  bounceRate?: number;
}

// --- Search Console --------------------------------------------------------

export interface SearchConsoleRow {
  siteUrl: string;
  query: string;
  page: string;
  country: string;
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// --- GTM -------------------------------------------------------------------

export interface GtmTag {
  tagId: string;
  name: string;
  type: string; // e.g. "gaawc" (GA4 config), "awct" (Ads conversion), "html"
  firingTriggerIds: string[];
}

export interface GtmTrigger {
  triggerId: string;
  name: string;
  type: string; // e.g. "formSubmission", "click", "pageview"
}

export interface GtmVariable {
  variableId: string;
  name: string;
  type: string;
}

export interface GtmSnapshot {
  accountId: string;
  containerId: string;
  workspaceId: string;
  tags: GtmTag[];
  triggers: GtmTrigger[];
  variables: GtmVariable[];
  builtInVariables: string[];
  detectedTrackingIssues: string[];
}

// --- Audit engine output ---------------------------------------------------

export interface ScoreBreakdown {
  /** 0–100. */
  score: number;
  label: string;
  evidence: string[];
  issues: string[];
  recommendations: string[];
}

export type ScoreKey =
  | "searchFunnel"
  | "seoFoundation"
  | "technicalSeo"
  | "contentQuality"
  | "localVisibility"
  | "aiSearchReadiness"
  | "ppcEfficiency"
  | "conversionTracking"
  | "landingPage"
  | "budgetWasteRisk"
  | "measurementConfidence";

export interface Recommendation {
  id: string;
  title: string;
  category: RecommendationCategory;
  severity: Severity;
  evidence: string[];
  whyItMatters: string;
  recommendedFix: string;
  estimatedImpact: string;
  difficulty: Difficulty;
  urgency: Urgency;
  confidence: Confidence;
  /** Priority = Impact × Confidence × Urgency ÷ Difficulty, normalized 0–100. */
  priorityScore: number;
  relatedEntityType: "campaign" | "ad_group" | "keyword" | "page" | "tracking" | "query" | null;
  relatedEntityId: string | null;
}

/** Content roadmap item produced by the content strategy engine. */
export interface ContentOpportunity {
  id: string;
  pageType:
    | "service"
    | "location_service"
    | "comparison"
    | "faq"
    | "proof"
    | "blog"
    | "gbp"
    | "media";
  title: string;
  slug: string;
  searchIntent: "informational" | "commercial" | "transactional" | "navigational";
  queryCluster: string[];
  userProblem: string;
  businessGoal: string;
  requiredSections: string[];
  trustElements: string[];
  suggestedCta: string;
  internalLinks: string[];
  structuredDataRecommendation: string;
  ppcRelevance: string;
  priorityScore: number;
}

export interface AbTest {
  id: string;
  testName: string;
  hypothesis: string;
  testType: string;
  control: string;
  variant: string;
  primaryMetric: string;
  secondaryMetric: string;
  successCriteria: string;
  minimumRuntime: string;
  difficulty: Difficulty;
  recommendedTool: string;
}

export interface ScoreSet {
  /** Overall Search Funnel Score. */
  searchFunnel: number;
  seoFoundation: number;
  technicalSeo: number;
  contentQuality: number;
  localVisibility: number;
  aiSearchReadiness: number;
  ppcEfficiency: number;
  conversionTracking: number;
  landingPage: number;
  /** Risk score — higher = worse. */
  budgetWasteRisk: number;
  measurementConfidence: number;
}

/** The complete, self-contained result of an audit run. */
export interface AuditReport {
  id: string;
  userId: string | null;
  businessId: string | null;
  businessName: string;
  websiteUrl: string;
  auditMode: AuditMode;
  dateStart: string;
  dateEnd: string;
  status: AuditStatus;
  scores: ScoreSet;
  breakdowns: Record<ScoreKey, ScoreBreakdown>;
  executiveSummary: string;
  recommendations: Recommendation[];
  abTests: AbTest[];
  contentOpportunities: ContentOpportunity[];
  crawledPages: CrawledPage[];
  siteSignals: SiteSignals | null;
  adsRows: GoogleAdsRow[];
  ga4Rows: Ga4Row[];
  searchConsoleRows: SearchConsoleRow[];
  gtm: GtmSnapshot | null;
  /** Per-step status used to drive the loading UI. */
  steps: AuditStep[];
  createdAt: string;
  completedAt: string | null;
  error?: string | null;
}

export interface AuditStep {
  key:
    | "crawl"
    | "crawlability"
    | "content"
    | "landing"
    | "ads"
    | "ga4"
    | "search_console"
    | "gtm"
    | "scoring"
    | "recommendations"
    | "report";
  label: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  detail?: string;
}

export interface AuditSummaryCard {
  id: string;
  businessName: string;
  websiteUrl: string;
  auditMode: AuditMode;
  status: AuditStatus;
  overallScore: number;
  criticalCount: number;
  createdAt: string;
}
