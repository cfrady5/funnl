import { z } from "zod";

export const onboardingSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(120),
  websiteUrl: z.string().min(3, "Website URL is required").max(300),
  industry: z.string().max(120).optional().or(z.literal("")),
  primaryLocation: z.string().max(160).optional().or(z.literal("")),
  monthlyAdBudget: z.coerce.number().min(0).max(10_000_000).optional(),
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
  profitableServices: z.array(z.string().max(120)).max(10).default([]),
  targetLocations: z.array(z.string().max(120)).max(20).default([]),
  adStatus: z.enum(["not_running", "running", "paused", "unknown"]),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const newAuditSchema = z.object({
  websiteUrl: z.string().min(3, "Website URL is required").max(300),
  businessId: z.string().optional(),
  mode: z.enum(["url_only", "connected"]),
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
