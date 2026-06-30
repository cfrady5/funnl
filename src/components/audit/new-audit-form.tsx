"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Globe,
  Link2,
  Loader2,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AuditMode,
  ConversionGoal,
  ManualAnalyticsInput,
  ManualBusinessContext,
  ManualPpcMetrics,
  ManualSeoMetrics,
  ManualTrackingMetrics,
  ManualWebsiteMetrics,
} from "@/lib/types";

interface BusinessOption {
  id: string;
  businessName: string;
  websiteUrl: string;
}

type SelectableMode = "url_only" | "manual" | "connected";
type TriState = "yes" | "no" | "unknown";

const GOAL_OPTIONS: { value: ConversionGoal; label: string }[] = [
  { value: "calls", label: "Phone calls" },
  { value: "form_fills", label: "Form fills" },
  { value: "bookings", label: "Bookings" },
  { value: "purchases", label: "Purchases" },
  { value: "demo_requests", label: "Demo requests" },
  { value: "newsletter_signup", label: "Newsletter signups" },
  { value: "other", label: "Other" },
];

const STEP_LABELS = ["Website", "Marketing", "Analytics", "Review"] as const;

const MODE_CARDS: {
  value: SelectableMode;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
}[] = [
  {
    value: "url_only",
    title: "Website only",
    description: "Crawl + SEO from the URL alone. Fastest, no numbers needed.",
    icon: Link2,
  },
  {
    value: "manual",
    title: "Manual analytics",
    description: "Add the numbers you know. Most value without Google access.",
    icon: PencilLine,
    recommended: true,
  },
  {
    value: "connected",
    title: "Connected Google data",
    description: "Pull live Google Ads, GA4, Search Console & GTM data.",
    icon: Database,
  },
];

/** Parse a comma/newline-separated string into a trimmed string[]. */
function toList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse a numeric input; returns undefined when blank/invalid. */
function toNum(value: string): number | undefined {
  const t = value.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Convert a user-typed percent (e.g. 0.9 meaning 0.9%) into a decimal (0.009). */
function toDecimal(value: string): number | undefined {
  const n = toNum(value);
  return n === undefined ? undefined : n / 100;
}

/** Map a tri-state control to a boolean | undefined (unknown → omit). */
function triToBool(v: TriState): boolean | undefined {
  if (v === "yes") return true;
  if (v === "no") return false;
  return undefined;
}

/** Drop undefined values so we only send fields the user actually filled. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== "") out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

export function NewAuditForm({
  businesses,
  canUseLiveData,
}: {
  businesses: BusinessOption[];
  canUseLiveData: boolean;
}) {
  const router = useRouter();

  const [step, setStep] = React.useState(0);
  const [mode, setMode] = React.useState<SelectableMode>("manual");

  // Step 1 — Website
  const [businessId, setBusinessId] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [businessName, setBusinessName] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [primaryLocation, setPrimaryLocation] = React.useState("");
  const [serviceArea, setServiceArea] = React.useState("");
  const [topServices, setTopServices] = React.useState("");
  const [profitableService, setProfitableService] = React.useState("");
  const [primaryGoal, setPrimaryGoal] = React.useState<"" | ConversionGoal>("");

  // Step 2 — Marketing context
  const [runningGoogleAds, setRunningGoogleAds] = React.useState("");
  const [doingSeo, setDoingSeo] = React.useState("");
  const [monthlyAdsBudget, setMonthlyAdsBudget] = React.useState("");
  const [monthlySeoBudget, setMonthlySeoBudget] = React.useState("");
  const [averageCustomerValue, setAverageCustomerValue] = React.useState("");
  const [closeRate, setCloseRate] = React.useState("");
  const [mostImportantConversion, setMostImportantConversion] = React.useState("");
  const [targetLocations, setTargetLocations] = React.useState("");
  const [competitors, setCompetitors] = React.useState("");

  // Step 3 — Website / GA4 metrics
  const [w, setW] = React.useState<StrMap>({
    sessions: "",
    users: "",
    organicSessions: "",
    paidSessions: "",
    conversions: "",
    conversionRate: "",
    topLandingPageUrl: "",
    topLandingPageSessions: "",
    topLandingPageConversions: "",
    bounceOrEngagementRate: "",
    mostImportantEvent: "",
  });
  const [wBool, setWBool] = React.useState<Record<string, TriState>>({
    formsTracked: "unknown",
    phoneClicksTracked: "unknown",
    bookingsOrPurchasesTracked: "unknown",
    hasThankYouPages: "unknown",
  });

  // Step 3 — PPC metrics
  const [p, setP] = React.useState<StrMap>({
    monthlySpend: "",
    impressions: "",
    clicks: "",
    ctr: "",
    avgCpc: "",
    conversions: "",
    costPerConversion: "",
    conversionRate: "",
    topCampaign: "",
    topAdGroup: "",
    topKeyword: "",
    worstKeyword: "",
  });
  const [pBool, setPBool] = React.useState<Record<string, TriState>>({
    brandedSeparated: "unknown",
    servicesSeparated: "unknown",
    negativeKeywordsUsed: "unknown",
    adExtensionsUsed: "unknown",
  });
  const [trafficDestination, setTrafficDestination] = React.useState("");

  // Step 3 — SEO metrics
  const [s, setS] = React.useState<StrMap>({
    organicClicks: "",
    organicImpressions: "",
    organicCtr: "",
    averagePosition: "",
    topQuery: "",
    topPage: "",
    highImpressionLowClickQuery: "",
    highImpressionLowCtrPage: "",
  });
  const [sBool, setSBool] = React.useState<Record<string, TriState>>({
    hasServicePages: "unknown",
    hasLocationPages: "unknown",
    hasBlog: "unknown",
    hasGoogleBusinessProfile: "unknown",
  });

  // Step 3 — Tracking metrics
  const [tBool, setTBool] = React.useState<Record<string, TriState>>({
    analyticsInstalled: "unknown",
    gtmInstalled: "unknown",
    adsConversionTracking: "unknown",
    phoneCallTracking: "unknown",
    formTracking: "unknown",
    bookingPurchaseTracking: "unknown",
    duplicateConversionsPossible: "unknown",
    knowsQualifiedLeadSources: "unknown",
  });

  const [knownIssues, setKnownIssues] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const forceDemo = mode === "connected" && !canUseLiveData;

  function handleBusinessChange(id: string) {
    setBusinessId(id);
    const biz = businesses.find((b) => b.id === id);
    if (biz) {
      if (biz.websiteUrl) setWebsiteUrl(biz.websiteUrl);
      if (biz.businessName) setBusinessName(biz.businessName);
    }
  }

  function next() {
    setError(null);
    if (step === 0 && !websiteUrl.trim()) {
      setError("Please enter a website URL to continue.");
      return;
    }
    setStep((cur) => Math.min(cur + 1, STEP_LABELS.length - 1));
  }

  function back() {
    setError(null);
    setStep((cur) => Math.max(cur - 1, 0));
  }

  function buildManualInput(): ManualAnalyticsInput {
    const businessContext: ManualBusinessContext = compact({
      runningGoogleAds:
        runningGoogleAds === ""
          ? undefined
          : (runningGoogleAds as ManualBusinessContext["runningGoogleAds"]),
      doingSeo:
        doingSeo === "" ? undefined : (doingSeo as ManualBusinessContext["doingSeo"]),
      monthlyAdsBudget: toNum(monthlyAdsBudget),
      monthlySeoBudget: toNum(monthlySeoBudget),
      averageCustomerValue: toNum(averageCustomerValue),
      closeRate: toDecimal(closeRate),
      mostImportantConversion: mostImportantConversion.trim() || undefined,
      targetLocations: targetLocations.trim() || undefined,
      competitors: competitors.trim() || undefined,
    });

    const websiteMetrics: ManualWebsiteMetrics = compact({
      sessions: toNum(w.sessions),
      users: toNum(w.users),
      organicSessions: toNum(w.organicSessions),
      paidSessions: toNum(w.paidSessions),
      conversions: toNum(w.conversions),
      conversionRate: toDecimal(w.conversionRate),
      topLandingPageUrl: w.topLandingPageUrl.trim() || undefined,
      topLandingPageSessions: toNum(w.topLandingPageSessions),
      topLandingPageConversions: toNum(w.topLandingPageConversions),
      bounceOrEngagementRate: toDecimal(w.bounceOrEngagementRate),
      mostImportantEvent: w.mostImportantEvent.trim() || undefined,
      formsTracked: triToBool(wBool.formsTracked),
      phoneClicksTracked: triToBool(wBool.phoneClicksTracked),
      bookingsOrPurchasesTracked: triToBool(wBool.bookingsOrPurchasesTracked),
      hasThankYouPages: triToBool(wBool.hasThankYouPages),
    });

    const ppcMetrics: ManualPpcMetrics = compact({
      monthlySpend: toNum(p.monthlySpend),
      impressions: toNum(p.impressions),
      clicks: toNum(p.clicks),
      ctr: toDecimal(p.ctr),
      avgCpc: toNum(p.avgCpc),
      conversions: toNum(p.conversions),
      costPerConversion: toNum(p.costPerConversion),
      conversionRate: toDecimal(p.conversionRate),
      topCampaign: p.topCampaign.trim() || undefined,
      topAdGroup: p.topAdGroup.trim() || undefined,
      topKeyword: p.topKeyword.trim() || undefined,
      worstKeyword: p.worstKeyword.trim() || undefined,
      brandedSeparated: triToBool(pBool.brandedSeparated),
      servicesSeparated: triToBool(pBool.servicesSeparated),
      negativeKeywordsUsed: triToBool(pBool.negativeKeywordsUsed),
      adExtensionsUsed: triToBool(pBool.adExtensionsUsed),
      trafficDestination:
        trafficDestination === ""
          ? undefined
          : (trafficDestination as ManualPpcMetrics["trafficDestination"]),
    });

    const seoMetrics: ManualSeoMetrics = compact({
      organicClicks: toNum(s.organicClicks),
      organicImpressions: toNum(s.organicImpressions),
      organicCtr: toDecimal(s.organicCtr),
      averagePosition: toNum(s.averagePosition),
      topQuery: s.topQuery.trim() || undefined,
      topPage: s.topPage.trim() || undefined,
      highImpressionLowClickQuery: s.highImpressionLowClickQuery.trim() || undefined,
      highImpressionLowCtrPage: s.highImpressionLowCtrPage.trim() || undefined,
      hasServicePages: triToBool(sBool.hasServicePages),
      hasLocationPages: triToBool(sBool.hasLocationPages),
      hasBlog: triToBool(sBool.hasBlog),
      hasGoogleBusinessProfile: triToBool(sBool.hasGoogleBusinessProfile),
    });

    const trackingMetrics: ManualTrackingMetrics = compact({
      analyticsInstalled: triToBool(tBool.analyticsInstalled),
      gtmInstalled: triToBool(tBool.gtmInstalled),
      adsConversionTracking: triToBool(tBool.adsConversionTracking),
      phoneCallTracking: triToBool(tBool.phoneCallTracking),
      formTracking: triToBool(tBool.formTracking),
      bookingPurchaseTracking: triToBool(tBool.bookingPurchaseTracking),
      duplicateConversionsPossible: triToBool(tBool.duplicateConversionsPossible),
      knowsQualifiedLeadSources: triToBool(tBool.knowsQualifiedLeadSources),
    });

    return {
      businessContext,
      websiteMetrics,
      ppcMetrics,
      seoMetrics,
      trackingMetrics,
      knownIssues: knownIssues.trim() || undefined,
      notes: notes.trim() || undefined,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!websiteUrl.trim()) {
      setError("Please enter a website URL.");
      setStep(0);
      return;
    }

    const auditMode: AuditMode = mode;
    const payload: Record<string, unknown> = {
      websiteUrl: websiteUrl.trim(),
      mode: auditMode,
      dateRange: "30d",
    };
    if (businessId) payload.businessId = businessId;
    if (businessName.trim()) payload.businessName = businessName.trim();
    if (industry.trim()) payload.industry = industry.trim();
    if (primaryLocation.trim()) payload.primaryLocation = primaryLocation.trim();
    if (serviceArea.trim()) payload.serviceArea = serviceArea.trim();
    const services = toList(topServices);
    if (services.length) payload.topServices = services;
    if (profitableService.trim()) payload.profitableService = profitableService.trim();
    if (primaryGoal) payload.primaryGoal = primaryGoal;
    if (notes.trim()) payload.notes = notes.trim();
    if (forceDemo) payload.demo = true;

    // Always include manual input (empty sub-objects are fine); the engine
    // uses whatever the user provided regardless of mode.
    payload.manualInput = buildManualInput();

    setSubmitting(true);
    try {
      const res = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        let code: string | undefined;
        try {
          const data = (await res.json()) as { error?: string };
          code = data.error;
        } catch {
          /* ignore parse failure */
        }
        setError(
          code === "INVALID_URL"
            ? "Please enter a valid website URL."
            : "Something went wrong starting the audit. Please try again.",
        );
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as { id: string };
      router.push(`/audit/${data.id}`);
    } catch {
      setError("Network error — please check your connection and try again.");
      setSubmitting(false);
    }
  }

  const progressValue = ((step + 1) / STEP_LABELS.length) * 100;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            Step {step + 1} of {STEP_LABELS.length}
          </span>
          <span className="text-muted-foreground">{STEP_LABELS[step]}</span>
        </div>
        <Progress value={progressValue} />
        <div className="hidden grid-cols-4 gap-2 sm:grid">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                i === step
                  ? "font-semibold text-primary"
                  : i < step
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {i < step ? (
                <CheckCircle2 className="size-3.5 shrink-0" />
              ) : (
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    i === step ? "border-primary text-primary" : "border-muted-foreground/40",
                  )}
                >
                  {i + 1}
                </span>
              )}
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Mode selector */}
      <div className="space-y-2">
        <Label>How much do you want to share?</Label>
        <div className="grid gap-3 md:grid-cols-3">
          {MODE_CARDS.map((m) => (
            <ModeCard
              key={m.value}
              active={mode === m.value}
              onClick={() => setMode(m.value)}
              icon={m.icon}
              title={m.title}
              description={m.description}
              recommended={m.recommended}
            />
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 py-6">
          {step === 0 && (
            <StepWebsite
              businesses={businesses}
              businessId={businessId}
              onBusinessChange={handleBusinessChange}
              websiteUrl={websiteUrl}
              setWebsiteUrl={setWebsiteUrl}
              businessName={businessName}
              setBusinessName={setBusinessName}
              industry={industry}
              setIndustry={setIndustry}
              primaryLocation={primaryLocation}
              setPrimaryLocation={setPrimaryLocation}
              serviceArea={serviceArea}
              setServiceArea={setServiceArea}
              topServices={topServices}
              setTopServices={setTopServices}
              profitableService={profitableService}
              setProfitableService={setProfitableService}
              primaryGoal={primaryGoal}
              setPrimaryGoal={setPrimaryGoal}
            />
          )}

          {step === 1 && (
            <StepMarketing
              runningGoogleAds={runningGoogleAds}
              setRunningGoogleAds={setRunningGoogleAds}
              doingSeo={doingSeo}
              setDoingSeo={setDoingSeo}
              monthlyAdsBudget={monthlyAdsBudget}
              setMonthlyAdsBudget={setMonthlyAdsBudget}
              monthlySeoBudget={monthlySeoBudget}
              setMonthlySeoBudget={setMonthlySeoBudget}
              averageCustomerValue={averageCustomerValue}
              setAverageCustomerValue={setAverageCustomerValue}
              closeRate={closeRate}
              setCloseRate={setCloseRate}
              mostImportantConversion={mostImportantConversion}
              setMostImportantConversion={setMostImportantConversion}
              targetLocations={targetLocations}
              setTargetLocations={setTargetLocations}
              competitors={competitors}
              setCompetitors={setCompetitors}
            />
          )}

          {step === 2 && (
            <StepAnalytics
              mode={mode}
              w={w}
              setW={setW}
              wBool={wBool}
              setWBool={setWBool}
              p={p}
              setP={setP}
              pBool={pBool}
              setPBool={setPBool}
              trafficDestination={trafficDestination}
              setTrafficDestination={setTrafficDestination}
              s={s}
              setS={setS}
              sBool={sBool}
              setSBool={setSBool}
              tBool={tBool}
              setTBool={setTBool}
              knownIssues={knownIssues}
              setKnownIssues={setKnownIssues}
              notes={notes}
              setNotes={setNotes}
            />
          )}

          {step === 3 && (
            <StepReview
              mode={mode}
              forceDemo={forceDemo}
              websiteUrl={websiteUrl}
              businessName={businessName}
              industry={industry}
              primaryLocation={primaryLocation}
              serviceArea={serviceArea}
              topServices={toList(topServices)}
              profitableService={profitableService}
              primaryGoal={primaryGoal}
              manualInput={buildManualInput()}
            />
          )}
        </CardContent>
      </Card>

      {error && (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          role="alert"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={back}
          disabled={step === 0 || submitting}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {step < STEP_LABELS.length - 1 ? (
          <Button type="button" onClick={next}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Starting audit…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate Audit
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 — Website                                                           */
/* -------------------------------------------------------------------------- */

function StepWebsite(props: {
  businesses: BusinessOption[];
  businessId: string;
  onBusinessChange: (id: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  businessName: string;
  setBusinessName: (v: string) => void;
  industry: string;
  setIndustry: (v: string) => void;
  primaryLocation: string;
  setPrimaryLocation: (v: string) => void;
  serviceArea: string;
  setServiceArea: (v: string) => void;
  topServices: string;
  setTopServices: (v: string) => void;
  profitableService: string;
  setProfitableService: (v: string) => void;
  primaryGoal: "" | ConversionGoal;
  setPrimaryGoal: (v: "" | ConversionGoal) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading
        icon={Globe}
        title="Your website"
        subtitle="Only the URL is required — the rest helps tailor the audit."
      />

      {props.businesses.length > 0 && (
        <Field label="Saved business (optional)" htmlFor="businessId">
          <Select
            id="businessId"
            value={props.businessId}
            onChange={(e) => props.onBusinessChange(e.target.value)}
          >
            <option value="">Just use the URL below</option>
            {props.businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.businessName}
              </option>
            ))}
          </Select>
          <Helper>Selecting a saved business pre-fills its website.</Helper>
        </Field>
      )}

      <Field label="Website URL" htmlFor="websiteUrl">
        <div className="relative">
          <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="text"
            inputMode="url"
            required
            placeholder="example.com"
            className="pl-9"
            value={props.websiteUrl}
            onChange={(e) => props.setWebsiteUrl(e.target.value)}
          />
        </div>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Business name" htmlFor="businessName">
          <Input
            id="businessName"
            placeholder="Acme Plumbing"
            value={props.businessName}
            onChange={(e) => props.setBusinessName(e.target.value)}
          />
        </Field>
        <Field label="Industry" htmlFor="industry">
          <Input
            id="industry"
            placeholder="Home services, SaaS, …"
            value={props.industry}
            onChange={(e) => props.setIndustry(e.target.value)}
          />
        </Field>
        <Field label="Primary location" htmlFor="primaryLocation">
          <Input
            id="primaryLocation"
            placeholder="Austin, TX"
            value={props.primaryLocation}
            onChange={(e) => props.setPrimaryLocation(e.target.value)}
          />
        </Field>
        <Field label="Service area" htmlFor="serviceArea">
          <Input
            id="serviceArea"
            placeholder="Greater Austin metro"
            value={props.serviceArea}
            onChange={(e) => props.setServiceArea(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Top services" htmlFor="topServices">
        <Textarea
          id="topServices"
          placeholder="Drain cleaning, water heater repair, leak detection…"
          value={props.topServices}
          onChange={(e) => props.setTopServices(e.target.value)}
        />
        <Helper>Separate with commas or new lines.</Helper>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Most profitable service" htmlFor="profitableService">
          <Input
            id="profitableService"
            placeholder="Water heater installs"
            value={props.profitableService}
            onChange={(e) => props.setProfitableService(e.target.value)}
          />
        </Field>
        <Field label="Primary conversion goal" htmlFor="primaryGoal">
          <Select
            id="primaryGoal"
            value={props.primaryGoal}
            onChange={(e) => props.setPrimaryGoal(e.target.value as "" | ConversionGoal)}
          >
            <option value="">Not specified</option>
            {GOAL_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — Marketing context                                                 */
/* -------------------------------------------------------------------------- */

function StepMarketing(props: {
  runningGoogleAds: string;
  setRunningGoogleAds: (v: string) => void;
  doingSeo: string;
  setDoingSeo: (v: string) => void;
  monthlyAdsBudget: string;
  setMonthlyAdsBudget: (v: string) => void;
  monthlySeoBudget: string;
  setMonthlySeoBudget: (v: string) => void;
  averageCustomerValue: string;
  setAverageCustomerValue: (v: string) => void;
  closeRate: string;
  setCloseRate: (v: string) => void;
  mostImportantConversion: string;
  setMostImportantConversion: (v: string) => void;
  targetLocations: string;
  setTargetLocations: (v: string) => void;
  competitors: string;
  setCompetitors: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading
        icon={BarChart3}
        title="Marketing context"
        subtitle="A quick picture of how you market today. All optional."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Running Google Ads?" htmlFor="runningGoogleAds">
          <Select
            id="runningGoogleAds"
            value={props.runningGoogleAds}
            onChange={(e) => props.setRunningGoogleAds(e.target.value)}
          >
            <option value="">Prefer not to say</option>
            <option value="yes">Yes, actively</option>
            <option value="paused">Paused right now</option>
            <option value="no">No</option>
            <option value="unsure">Not sure</option>
          </Select>
        </Field>
        <Field label="Doing SEO?" htmlFor="doingSeo">
          <Select
            id="doingSeo"
            value={props.doingSeo}
            onChange={(e) => props.setDoingSeo(e.target.value)}
          >
            <option value="">Prefer not to say</option>
            <option value="yes">Yes, actively</option>
            <option value="somewhat">Somewhat / occasionally</option>
            <option value="no">No</option>
            <option value="unsure">Not sure</option>
          </Select>
        </Field>
        <Field label="Monthly ads budget" htmlFor="monthlyAdsBudget">
          <PrefixInput
            id="monthlyAdsBudget"
            prefix="$"
            placeholder="2,000"
            value={props.monthlyAdsBudget}
            onChange={props.setMonthlyAdsBudget}
          />
        </Field>
        <Field label="Monthly SEO budget" htmlFor="monthlySeoBudget">
          <PrefixInput
            id="monthlySeoBudget"
            prefix="$"
            placeholder="1,000"
            value={props.monthlySeoBudget}
            onChange={props.setMonthlySeoBudget}
          />
        </Field>
        <Field label="Average customer value" htmlFor="averageCustomerValue">
          <PrefixInput
            id="averageCustomerValue"
            prefix="$"
            placeholder="500"
            value={props.averageCustomerValue}
            onChange={props.setAverageCustomerValue}
          />
        </Field>
        <Field label="Lead-to-customer close rate" htmlFor="closeRate">
          <PrefixInput
            id="closeRate"
            suffix="%"
            placeholder="25"
            value={props.closeRate}
            onChange={props.setCloseRate}
          />
        </Field>
      </div>

      <Field label="Most important conversion" htmlFor="mostImportantConversion">
        <Input
          id="mostImportantConversion"
          placeholder="Phone calls from new customers"
          value={props.mostImportantConversion}
          onChange={(e) => props.setMostImportantConversion(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Target locations" htmlFor="targetLocations">
          <Input
            id="targetLocations"
            placeholder="Austin, Round Rock, Cedar Park"
            value={props.targetLocations}
            onChange={(e) => props.setTargetLocations(e.target.value)}
          />
        </Field>
        <Field label="Main competitors" htmlFor="competitors">
          <Input
            id="competitors"
            placeholder="competitor1.com, competitor2.com"
            value={props.competitors}
            onChange={(e) => props.setCompetitors(e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 3 — Manual analytics                                                  */
/* -------------------------------------------------------------------------- */

type StrMap = Record<string, string>;
type BoolMap = Record<string, TriState>;

function StepAnalytics(props: {
  mode: SelectableMode;
  w: StrMap;
  setW: React.Dispatch<React.SetStateAction<StrMap>>;
  wBool: BoolMap;
  setWBool: React.Dispatch<React.SetStateAction<BoolMap>>;
  p: StrMap;
  setP: React.Dispatch<React.SetStateAction<StrMap>>;
  pBool: BoolMap;
  setPBool: React.Dispatch<React.SetStateAction<BoolMap>>;
  trafficDestination: string;
  setTrafficDestination: (v: string) => void;
  s: StrMap;
  setS: React.Dispatch<React.SetStateAction<StrMap>>;
  sBool: BoolMap;
  setSBool: React.Dispatch<React.SetStateAction<BoolMap>>;
  tBool: BoolMap;
  setTBool: React.Dispatch<React.SetStateAction<BoolMap>>;
  knownIssues: string;
  setKnownIssues: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
}) {
  const setStr =
    (setter: React.Dispatch<React.SetStateAction<StrMap>>, key: string) => (v: string) =>
      setter((prev) => ({ ...prev, [key]: v }));
  const setBool =
    (setter: React.Dispatch<React.SetStateAction<BoolMap>>, key: string) => (v: TriState) =>
      setter((prev) => ({ ...prev, [key]: v }));

  return (
    <div className="space-y-6">
      <SectionHeading
        icon={PencilLine}
        title="Analytics data"
        subtitle={
          props.mode === "url_only"
            ? "Optional for a website-only audit — add anything you happen to know."
            : "Add whatever numbers you have. Everything here is optional."
        }
      />

      {props.mode === "manual" && (
        <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Leave blank if unknown — srchr will flag lower confidence.
        </p>
      )}

      {/* Website / GA4 */}
      <Group title="Website / GA4">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField label="Sessions" value={props.w.sessions} onChange={setStr(props.setW, "sessions")} />
          <NumberField label="Users" value={props.w.users} onChange={setStr(props.setW, "users")} />
          <NumberField label="Organic sessions" value={props.w.organicSessions} onChange={setStr(props.setW, "organicSessions")} />
          <NumberField label="Paid sessions" value={props.w.paidSessions} onChange={setStr(props.setW, "paidSessions")} />
          <NumberField label="Conversions" value={props.w.conversions} onChange={setStr(props.setW, "conversions")} />
          <PercentField label="Conversion rate" value={props.w.conversionRate} onChange={setStr(props.setW, "conversionRate")} />
          <PercentField label="Bounce / engagement rate" value={props.w.bounceOrEngagementRate} onChange={setStr(props.setW, "bounceOrEngagementRate")} />
          <NumberField label="Top landing page sessions" value={props.w.topLandingPageSessions} onChange={setStr(props.setW, "topLandingPageSessions")} />
          <NumberField label="Top landing page conversions" value={props.w.topLandingPageConversions} onChange={setStr(props.setW, "topLandingPageConversions")} />
        </div>
        <TextField label="Top landing page URL" value={props.w.topLandingPageUrl} onChange={setStr(props.setW, "topLandingPageUrl")} placeholder="example.com/services" />
        <TextField label="Most important event" value={props.w.mostImportantEvent} onChange={setStr(props.setW, "mostImportantEvent")} placeholder="contact_form_submit" />
        <div className="grid gap-3 md:grid-cols-2">
          <TriField label="Forms tracked?" value={props.wBool.formsTracked} onChange={setBool(props.setWBool, "formsTracked")} />
          <TriField label="Phone clicks tracked?" value={props.wBool.phoneClicksTracked} onChange={setBool(props.setWBool, "phoneClicksTracked")} />
          <TriField label="Bookings / purchases tracked?" value={props.wBool.bookingsOrPurchasesTracked} onChange={setBool(props.setWBool, "bookingsOrPurchasesTracked")} />
          <TriField label="Have thank-you pages?" value={props.wBool.hasThankYouPages} onChange={setBool(props.setWBool, "hasThankYouPages")} />
        </div>
      </Group>

      {/* Google Ads / PPC */}
      <Group title="Google Ads / PPC">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField label="Monthly spend ($)" value={props.p.monthlySpend} onChange={setStr(props.setP, "monthlySpend")} />
          <NumberField label="Impressions" value={props.p.impressions} onChange={setStr(props.setP, "impressions")} />
          <NumberField label="Clicks" value={props.p.clicks} onChange={setStr(props.setP, "clicks")} />
          <PercentField label="CTR" value={props.p.ctr} onChange={setStr(props.setP, "ctr")} />
          <NumberField label="Avg. CPC ($)" value={props.p.avgCpc} onChange={setStr(props.setP, "avgCpc")} />
          <NumberField label="Conversions" value={props.p.conversions} onChange={setStr(props.setP, "conversions")} />
          <NumberField label="Cost per conversion ($)" value={props.p.costPerConversion} onChange={setStr(props.setP, "costPerConversion")} />
          <PercentField label="Conversion rate" value={props.p.conversionRate} onChange={setStr(props.setP, "conversionRate")} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Top campaign" value={props.p.topCampaign} onChange={setStr(props.setP, "topCampaign")} />
          <TextField label="Top ad group" value={props.p.topAdGroup} onChange={setStr(props.setP, "topAdGroup")} />
          <TextField label="Top keyword" value={props.p.topKeyword} onChange={setStr(props.setP, "topKeyword")} />
          <TextField label="Worst keyword" value={props.p.worstKeyword} onChange={setStr(props.setP, "worstKeyword")} />
        </div>
        <Field label="Where does ad traffic go?" htmlFor="trafficDestination">
          <Select
            id="trafficDestination"
            value={props.trafficDestination}
            onChange={(e) => props.setTrafficDestination(e.target.value)}
          >
            <option value="">Unknown</option>
            <option value="homepage">Homepage</option>
            <option value="dedicated">Dedicated landing pages</option>
            <option value="mixed">Mixed</option>
          </Select>
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <TriField label="Branded campaigns separated?" value={props.pBool.brandedSeparated} onChange={setBool(props.setPBool, "brandedSeparated")} />
          <TriField label="Services separated by campaign?" value={props.pBool.servicesSeparated} onChange={setBool(props.setPBool, "servicesSeparated")} />
          <TriField label="Negative keywords used?" value={props.pBool.negativeKeywordsUsed} onChange={setBool(props.setPBool, "negativeKeywordsUsed")} />
          <TriField label="Ad extensions used?" value={props.pBool.adExtensionsUsed} onChange={setBool(props.setPBool, "adExtensionsUsed")} />
        </div>
      </Group>

      {/* Search Console / SEO */}
      <Group title="Search Console / SEO">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField label="Organic clicks" value={props.s.organicClicks} onChange={setStr(props.setS, "organicClicks")} />
          <NumberField label="Organic impressions" value={props.s.organicImpressions} onChange={setStr(props.setS, "organicImpressions")} />
          <PercentField label="Organic CTR" value={props.s.organicCtr} onChange={setStr(props.setS, "organicCtr")} />
          <NumberField label="Average position" value={props.s.averagePosition} onChange={setStr(props.setS, "averagePosition")} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Top query" value={props.s.topQuery} onChange={setStr(props.setS, "topQuery")} />
          <TextField label="Top page" value={props.s.topPage} onChange={setStr(props.setS, "topPage")} />
          <TextField label="High-impression / low-click query" value={props.s.highImpressionLowClickQuery} onChange={setStr(props.setS, "highImpressionLowClickQuery")} />
          <TextField label="High-impression / low-CTR page" value={props.s.highImpressionLowCtrPage} onChange={setStr(props.setS, "highImpressionLowCtrPage")} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TriField label="Have service pages?" value={props.sBool.hasServicePages} onChange={setBool(props.setSBool, "hasServicePages")} />
          <TriField label="Have location pages?" value={props.sBool.hasLocationPages} onChange={setBool(props.setSBool, "hasLocationPages")} />
          <TriField label="Have a blog?" value={props.sBool.hasBlog} onChange={setBool(props.setSBool, "hasBlog")} />
          <TriField label="Have a Google Business Profile?" value={props.sBool.hasGoogleBusinessProfile} onChange={setBool(props.setSBool, "hasGoogleBusinessProfile")} />
        </div>
      </Group>

      {/* Tracking / GTM */}
      <Group title="Tracking / GTM">
        <div className="grid gap-3 md:grid-cols-2">
          <TriField label="Analytics installed?" value={props.tBool.analyticsInstalled} onChange={setBool(props.setTBool, "analyticsInstalled")} />
          <TriField label="GTM installed?" value={props.tBool.gtmInstalled} onChange={setBool(props.setTBool, "gtmInstalled")} />
          <TriField label="Ads conversion tracking?" value={props.tBool.adsConversionTracking} onChange={setBool(props.setTBool, "adsConversionTracking")} />
          <TriField label="Phone-call tracking?" value={props.tBool.phoneCallTracking} onChange={setBool(props.setTBool, "phoneCallTracking")} />
          <TriField label="Form tracking?" value={props.tBool.formTracking} onChange={setBool(props.setTBool, "formTracking")} />
          <TriField label="Booking / purchase tracking?" value={props.tBool.bookingPurchaseTracking} onChange={setBool(props.setTBool, "bookingPurchaseTracking")} />
          <TriField label="Duplicate conversions possible?" value={props.tBool.duplicateConversionsPossible} onChange={setBool(props.setTBool, "duplicateConversionsPossible")} />
          <TriField label="Know which sources drive qualified leads?" value={props.tBool.knowsQualifiedLeadSources} onChange={setBool(props.setTBool, "knowsQualifiedLeadSources")} />
        </div>
      </Group>

      {/* Free text */}
      <Field label="Known issues" htmlFor="knownIssues">
        <Textarea
          id="knownIssues"
          placeholder="Anything you already suspect is broken or underperforming…"
          value={props.knownIssues}
          onChange={(e) => props.setKnownIssues(e.target.value)}
          maxLength={2000}
        />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea
          id="notes"
          placeholder="Recent changes, priorities, context the audit should know…"
          value={props.notes}
          onChange={(e) => props.setNotes(e.target.value)}
          maxLength={2000}
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 4 — Review                                                            */
/* -------------------------------------------------------------------------- */

function StepReview(props: {
  mode: SelectableMode;
  forceDemo: boolean;
  websiteUrl: string;
  businessName: string;
  industry: string;
  primaryLocation: string;
  serviceArea: string;
  topServices: string[];
  profitableService: string;
  primaryGoal: "" | ConversionGoal;
  manualInput: ManualAnalyticsInput;
}) {
  const modeLabel =
    props.mode === "url_only"
      ? "Website only"
      : props.mode === "manual"
        ? "Manual analytics"
        : "Connected Google data";

  const goalLabel = GOAL_OPTIONS.find((g) => g.value === props.primaryGoal)?.label;

  const websiteRows: [string, string | undefined][] = [
    ["Website", props.websiteUrl],
    ["Business", props.businessName],
    ["Industry", props.industry],
    ["Primary location", props.primaryLocation],
    ["Service area", props.serviceArea],
    ["Top services", props.topServices.join(", ")],
    ["Most profitable service", props.profitableService],
    ["Primary goal", goalLabel],
    ["Audit type", modeLabel],
  ];

  return (
    <div className="space-y-6">
      <SectionHeading
        icon={CheckCircle2}
        title="Review & run"
        subtitle="Here's what srchr will analyze."
      />

      <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Don&apos;t know every number? That&apos;s okay. srchr will use what you
        provide and flag areas where tracking is incomplete.
      </p>

      {props.forceDemo && (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          No Google credentials are configured, so this connected audit will run
          against realistic sample Google data.
        </p>
      )}

      <ReviewSection title="Website" rows={websiteRows} />
      <ReviewSection title="Marketing context" rows={recordToRows(props.manualInput.businessContext)} />
      <ReviewSection title="Website / GA4" rows={recordToRows(props.manualInput.websiteMetrics)} />
      <ReviewSection title="Google Ads / PPC" rows={recordToRows(props.manualInput.ppcMetrics)} />
      <ReviewSection title="Search Console / SEO" rows={recordToRows(props.manualInput.seoMetrics)} />
      <ReviewSection title="Tracking / GTM" rows={recordToRows(props.manualInput.trackingMetrics)} />
      <ReviewSection
        title="Notes"
        rows={[
          ["Known issues", props.manualInput.knownIssues],
          ["Notes", props.manualInput.notes],
        ]}
      />
    </div>
  );
}

function recordToRows(obj: object): [string, string | undefined][] {
  return Object.entries(obj).map(([k, v]) => {
    let display: string | undefined;
    if (v === undefined || v === "") display = undefined;
    else if (typeof v === "boolean") display = v ? "Yes" : "No";
    else display = String(v);
    return [humanize(k), display];
  });
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function ReviewSection({
  title,
  rows,
}: {
  title: string;
  rows: [string, string | undefined][];
}) {
  const filled = rows.filter(([, v]) => v !== undefined && v !== "");
  if (filled.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <Separator />
      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {filled.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared field primitives                                                    */
/* -------------------------------------------------------------------------- */

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="font-semibold leading-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="space-y-4 py-5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = React.useId();
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        placeholder="—"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function PercentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = React.useId();
  return (
    <Field label={`${label} (%)`} htmlFor={id}>
      <PrefixInput id={id} suffix="%" placeholder="—" value={value} onChange={onChange} numeric />
    </Field>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = React.useId();
  return (
    <Field label={label} htmlFor={id}>
      <Input id={id} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function PrefixInput({
  id,
  prefix,
  suffix,
  placeholder,
  value,
  onChange,
  numeric,
}: {
  id?: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(prefix && "pl-7", (suffix || numeric) && "pr-8")}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

function TriField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  const options: { value: TriState; label: string }[] = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "unknown", label: "?" },
  ];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-input">
        {options.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              i > 0 && "border-l border-input",
              value === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent",
            )}
            aria-pressed={value === opt.value}
            title={opt.value === "unknown" ? "Unknown" : opt.label}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mode card                                                                  */
/* -------------------------------------------------------------------------- */

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  description,
  recommended,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={cn(
          "relative h-full transition-colors",
          active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40",
        )}
      >
        {recommended && (
          <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            Recommended
          </span>
        )}
        <CardContent className="flex gap-3 py-4">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
