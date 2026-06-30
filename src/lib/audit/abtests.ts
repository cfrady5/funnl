/**
 * A/B testing plan generator.
 *
 * Produces concrete, ready-to-run experiments tailored to the audit findings.
 * Tests are prioritized to the weakest areas: if landing pages scored poorly,
 * landing-page tests come first; if CTR is weak, ad copy tests lead.
 */

import { generateId } from "@/lib/utils";
import type { AbTest, ConversionGoal, Difficulty } from "@/lib/types";
import type { ScoringInput } from "./scoring";

function test(t: Omit<AbTest, "id">): AbTest {
  return { id: generateId("abt"), ...t };
}

const goalMetric: Record<ConversionGoal, string> = {
  calls: "Phone-call conversion rate",
  form_fills: "Form-submit conversion rate",
  bookings: "Booking completion rate",
  purchases: "Purchase conversion rate",
  demo_requests: "Demo-request conversion rate",
  newsletter_signup: "Signup conversion rate",
  other: "Primary conversion rate",
};

export function generateAbTests(input: ScoringInput): AbTest[] {
  const goal = input.business?.primaryConversionGoal ?? "form_fills";
  const primary = goalMetric[goal];
  const easy: Difficulty = "easy";
  const medium: Difficulty = "medium";

  const tests: AbTest[] = [
    test({
      testName: "Free Quote CTA Test",
      hypothesis:
        "Changing the CTA from 'Contact Us' to 'Get a Free Quote Today' will increase form submissions by making the next step more specific and lower-commitment.",
      testType: "CTA button copy",
      control: "Button reads 'Contact Us'",
      variant: "Button reads 'Get a Free Quote Today'",
      primaryMetric: primary,
      secondaryMetric: "Click-to-form-start rate",
      successCriteria:
        "Variant wins if conversion rate improves at 95% confidence without reducing lead quality.",
      minimumRuntime: "2–3 weeks or 100 conversions per variant, whichever comes first.",
      difficulty: easy,
      recommendedTool: "Google Optimize alternative (VWO / Optimizely) or a server-side split via Next.js middleware.",
    }),
    test({
      testName: "Ad Headline Intent-Match Test",
      hypothesis:
        "Headlines that mirror the exact search query plus the city will raise CTR versus generic brand-led headlines.",
      testType: "Responsive search ad headline",
      control: "Current generic headlines",
      variant: "Headlines that include the keyword + location + offer",
      primaryMetric: "Click-through rate (CTR)",
      secondaryMetric: "Conversion rate",
      successCriteria: "Variant wins if CTR rises without a drop in conversion rate.",
      minimumRuntime: "2 weeks or 2,000 impressions per ad.",
      difficulty: easy,
      recommendedTool: "Google Ads ad variations / RSA asset testing.",
    }),
    test({
      testName: "Landing Page Hero Headline Test",
      hypothesis:
        "A hero headline naming the specific service + location will outconvert a generic brand headline for paid traffic.",
      testType: "Landing page hero headline",
      control: "Generic brand headline",
      variant: "Service + location + outcome headline (e.g. 'Weekly Lawn Mowing in West Lafayette')",
      primaryMetric: primary,
      secondaryMetric: "Bounce / engagement rate",
      successCriteria: "Variant wins at 95% confidence on the primary metric.",
      minimumRuntime: "3 weeks or 100 conversions per variant.",
      difficulty: medium,
      recommendedTool: "VWO / Optimizely or a Next.js A/B route.",
    }),
    test({
      testName: "Short Form vs. Long Form Test",
      hypothesis:
        "Reducing the lead form from 6 fields to 3 (name, phone, service) will increase completions for paid traffic.",
      testType: "Lead form length",
      control: "6-field form",
      variant: "3-field form",
      primaryMetric: primary,
      secondaryMetric: "Lead quality (sales-qualified rate)",
      successCriteria:
        "Variant wins if completion rate rises without a meaningful drop in lead quality.",
      minimumRuntime: "3 weeks or 100 submissions per variant.",
      difficulty: medium,
      recommendedTool: "Form builder split test or VWO.",
    }),
    test({
      testName: "Trust Signals Above the Fold Test",
      hypothesis:
        "Adding reviews, a star rating, and a 'licensed & insured' badge above the fold will increase conversions by reducing perceived risk.",
      testType: "Trust signals / social proof",
      control: "No trust signals above the fold",
      variant: "Star rating + review count + trust badges above the fold",
      primaryMetric: primary,
      secondaryMetric: "Scroll depth",
      successCriteria: "Variant wins at 95% confidence on the primary metric.",
      minimumRuntime: "3 weeks.",
      difficulty: medium,
      recommendedTool: "VWO / Optimizely.",
    }),
    test({
      testName: "Offer Framing Test",
      hypothesis:
        "Framing the offer as 'First Mow 50% Off' will outperform 'Free Estimate' for click-to-lead conversion.",
      testType: "Offer framing",
      control: "'Free Estimate' offer",
      variant: "'First Mow 50% Off' offer",
      primaryMetric: primary,
      secondaryMetric: "Cost per acquisition (CPA)",
      successCriteria: "Variant wins if CPA improves without lowering average customer value.",
      minimumRuntime: "3–4 weeks.",
      difficulty: medium,
      recommendedTool: "Google Ads + landing page split test.",
    }),
    test({
      testName: "Ad Description Benefit Test",
      hypothesis:
        "Descriptions leading with a concrete benefit + guarantee will lift CTR and conversion rate over feature lists.",
      testType: "Ad description",
      control: "Feature-led descriptions",
      variant: "Benefit + guarantee-led descriptions",
      primaryMetric: "Conversion rate",
      secondaryMetric: "CTR",
      successCriteria: "Variant wins at 95% confidence on conversion rate.",
      minimumRuntime: "2–3 weeks.",
      difficulty: easy,
      recommendedTool: "Google Ads RSA asset testing.",
    }),
    test({
      testName: "Landing Page Layout Test",
      hypothesis:
        "A single-column, form-first layout will convert paid mobile traffic better than the current multi-section layout.",
      testType: "Landing page layout",
      control: "Current multi-section layout",
      variant: "Single-column, form-first, minimal-nav layout",
      primaryMetric: primary,
      secondaryMetric: "Mobile conversion rate",
      successCriteria: "Variant wins at 95% confidence, especially on mobile.",
      minimumRuntime: "3–4 weeks.",
      difficulty: "hard",
      recommendedTool: "VWO / Optimizely or dedicated landing page builder (Unbounce/Instapage).",
    }),
  ];

  // Reorder so tests targeting the weakest score appear first.
  const weakLP = (input.pages.length > 0 && !input.pages.some((p) => p.forms.length > 0));
  if (weakLP) {
    tests.sort((a, b) => (a.testType.includes("Landing") ? -1 : 1));
  }
  return tests;
}
