"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { onboardingSchema } from "@/lib/validation";
import { saveBusiness } from "@/lib/store";
import { generateId, normalizeUrl } from "@/lib/utils";
import {
  connectProvider,
  disconnectProvider,
  syncProvider,
  saveSelections,
  ensureDemoIntegrations,
} from "@/lib/integrations";
import { DEMO_MODE, capabilities } from "@/lib/config";
import type { Business, IntegrationProvider } from "@/lib/types";

function parseList(value: FormDataEntryValue | null): string[] {
  if (!value) return [];
  return String(value)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function saveOnboardingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = {
    businessName: formData.get("businessName"),
    websiteUrl: formData.get("websiteUrl"),
    industry: formData.get("industry") ?? "",
    primaryLocation: formData.get("primaryLocation") ?? "",
    serviceArea: formData.get("serviceArea") ?? "",
    monthlyAdBudget: formData.get("monthlyAdBudget") || undefined,
    monthlyMarketingBudget: formData.get("monthlyMarketingBudget") || undefined,
    primaryConversionGoal: formData.get("primaryConversionGoal"),
    averageCustomerValue: formData.get("averageCustomerValue") || undefined,
    topServices: parseList(formData.get("topServices")),
    profitableServices: parseList(formData.get("profitableServices")),
    targetLocations: parseList(formData.get("targetLocations")),
    competitors: parseList(formData.get("competitors")),
    targetCustomer: formData.get("targetCustomer") ?? "",
    adStatus: formData.get("adStatus"),
    marketingStatus: formData.get("marketingStatus") ?? "unknown",
  };

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    redirect(`/onboarding?error=${encodeURIComponent(msg)}`);
  }
  const data = parsed.data;
  const url = normalizeUrl(data.websiteUrl);
  if (!url) redirect(`/onboarding?error=${encodeURIComponent("Please enter a valid website URL")}`);

  const now = new Date().toISOString();
  const business: Business = {
    id: generateId("biz"),
    userId: user.id,
    businessName: data.businessName,
    websiteUrl: url!,
    industry: data.industry || null,
    primaryLocation: data.primaryLocation || null,
    serviceArea: data.serviceArea || null,
    monthlyAdBudget: data.monthlyAdBudget ?? null,
    monthlyMarketingBudget: data.monthlyMarketingBudget ?? null,
    primaryConversionGoal: data.primaryConversionGoal,
    averageCustomerValue: data.averageCustomerValue ?? null,
    topServices: data.topServices,
    profitableServices: data.profitableServices,
    targetLocations: data.targetLocations,
    competitors: data.competitors,
    targetCustomer: data.targetCustomer || null,
    adStatus: data.adStatus,
    marketingStatus: data.marketingStatus,
    createdAt: now,
    updatedAt: now,
  };
  await saveBusiness(business);
  revalidatePath("/dashboard");
  redirect("/dashboard?onboarded=1");
}

// --- Integrations (demo-aware) --------------------------------------------

export async function connectIntegrationAction(provider: IntegrationProvider) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (DEMO_MODE || !capabilities.hasGoogleOAuth) {
    // No real OAuth available — simulate a successful connect for the demo.
    connectProvider(user.id, provider, ["demo"]);
    revalidatePath("/integrations");
    return;
  }
  // Real OAuth: send the user to Google consent for this provider's scopes.
  redirect(`/api/oauth/google?provider=${provider}`);
}

export async function disconnectIntegrationAction(provider: IntegrationProvider) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  disconnectProvider(user.id, provider);
  revalidatePath("/integrations");
}

export async function syncIntegrationAction(provider: IntegrationProvider) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  syncProvider(user.id, provider);
  revalidatePath("/integrations");
}

export async function seedDemoIntegrationsAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  ensureDemoIntegrations(user.id);
  revalidatePath("/integrations");
}

export async function saveSelectionsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  saveSelections(user.id, String(formData.get("businessId") ?? "demo_business"), {
    googleAdsCustomerId: (formData.get("googleAdsCustomerId") as string) || null,
    ga4PropertyId: (formData.get("ga4PropertyId") as string) || null,
    searchConsoleSiteUrl: (formData.get("searchConsoleSiteUrl") as string) || null,
    gtmAccountId: (formData.get("gtmAccountId") as string) || null,
    gtmContainerId: (formData.get("gtmContainerId") as string) || null,
    gtmWorkspaceId: (formData.get("gtmWorkspaceId") as string) || null,
  });
  revalidatePath("/integrations");
}
