/**
 * Executive summary layer.
 *
 * If AI_API_KEY is configured, we ask Claude to turn the structured audit
 * findings into a polished, client-friendly narrative. If not, we fall back to
 * a deterministic template that still reads well and cites the real numbers.
 *
 * The AI NEVER invents findings — it only narrates the structured data passed
 * to it. Scores and recommendations always come from the deterministic engine.
 */

import { env, capabilities } from "@/lib/config";
import type { AuditReport, Recommendation, ScoreSet } from "@/lib/types";

interface SummaryContext {
  businessName: string;
  websiteUrl: string;
  scores: ScoreSet;
  topRecommendations: Recommendation[];
  criticalCount: number;
  connected: boolean;
}

export async function generateExecutiveSummary(report: AuditReport): Promise<string> {
  const ctx: SummaryContext = {
    businessName: report.businessName,
    websiteUrl: report.websiteUrl,
    scores: report.scores,
    topRecommendations: report.recommendations.slice(0, 5),
    criticalCount: report.recommendations.filter((r) => r.severity === "critical").length,
    connected: report.auditMode === "connected",
  };

  if (capabilities.hasAI) {
    try {
      return await aiSummary(ctx);
    } catch (err) {
      // Never fail the audit because the AI layer errored — fall back.
      console.error("AI summary failed, using deterministic fallback:", err);
    }
  }
  return deterministicSummary(ctx);
}

function deterministicSummary(ctx: SummaryContext): string {
  const { scores } = ctx;
  const grade =
    scores.overall >= 80 ? "strong" : scores.overall >= 60 ? "solid but improvable" : scores.overall >= 40 ? "underperforming" : "at significant risk";

  const lines: string[] = [];
  lines.push(
    `${ctx.businessName}'s paid search readiness scores ${scores.overall}/100 — ${grade}. ` +
      `This audit reviewed ${ctx.connected ? "live Google Ads, GA4, Search Console, and Tag Manager data" : "the website's structure and conversion readiness"} for ${ctx.websiteUrl}.`,
  );

  const weak: string[] = [];
  if (scores.landingPage < 65) weak.push(`landing-page conversion readiness (${scores.landingPage}/100)`);
  if (scores.tracking < 65) weak.push(`conversion tracking confidence (${scores.tracking}/100)`);
  if (scores.paidSearch < 65 && ctx.connected) weak.push(`paid search efficiency (${scores.paidSearch}/100)`);
  if (scores.budgetWaste > 45 && ctx.connected) weak.push(`elevated budget-waste risk (${scores.budgetWaste}/100)`);

  if (weak.length > 0) {
    lines.push(`The biggest drags on performance are ${weak.join(", ")}.`);
  }

  if (ctx.criticalCount > 0) {
    lines.push(
      `${ctx.criticalCount} critical issue${ctx.criticalCount > 1 ? "s" : ""} should be addressed before increasing spend, because scaling on top of them just amplifies waste.`,
    );
  }

  if (ctx.topRecommendations.length > 0) {
    lines.push("Highest-priority moves:");
    for (const r of ctx.topRecommendations.slice(0, 3)) {
      lines.push(`• ${r.title} — ${r.estimatedImpact}`);
    }
  }

  lines.push(
    "Tackle the critical issues and quick wins first; they typically recover wasted spend and lift conversion rate within the first 30 days, before any budget increase.",
  );

  return lines.join("\n\n");
}

async function aiSummary(ctx: SummaryContext): Promise<string> {
  // Minimal Anthropic Messages API call — no SDK dependency required.
  const prompt = `You are a senior paid-search strategist writing the executive summary of an SEM audit for a small local business owner. Be specific, direct, and non-generic. Use the structured findings below. Do NOT invent numbers or issues beyond what is provided. 3–5 short paragraphs, plain language, no fluff.

Business: ${ctx.businessName}
Website: ${ctx.websiteUrl}
Mode: ${ctx.connected ? "Connected data audit" : "URL-only audit"}
Scores (0-100): overall=${ctx.scores.overall}, paidSearch=${ctx.scores.paidSearch}, landingPage=${ctx.scores.landingPage}, tracking=${ctx.scores.tracking}, keyword=${ctx.scores.keyword}, budgetWasteRisk=${ctx.scores.budgetWaste}
Critical issues: ${ctx.criticalCount}
Top recommendations:
${ctx.topRecommendations.map((r) => `- [${r.severity}] ${r.title}: ${r.whyItMatters} Impact: ${r.estimatedImpact}`).join("\n")}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.aiApiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.aiModel,
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}`);
  }
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();
  return text || deterministicSummary(ctx);
}
