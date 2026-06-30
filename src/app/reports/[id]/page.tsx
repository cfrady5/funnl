import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Zap,
  Search,
  LayoutGrid,
  PenLine,
  MousePointerClick,
  ShieldCheck,
  PiggyBank,
  FlaskConical,
  CalendarCheck,
  FileText,
  ArrowLeft,
  Globe,
  ExternalLink,
  Gauge,
  Wrench,
  Sparkles,
  BookOpen,
  TrendingUp,
  Rocket,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreRing } from "@/components/ui/score-ring";
import { ScoreCard } from "@/components/report/score-card";
import { RecommendationCard } from "@/components/report/recommendation-card";
import { SeverityBadge, DifficultyBadge } from "@/components/report/severity-badge";
import { ReportToolbar } from "@/components/report/report-toolbar";
import { CtrByAdGroupChart, SpendVsConversionsChart, ScoreBarsChart } from "@/components/report/charts";
import { Logo } from "@/components/logo";
import { getAudit } from "@/lib/store";
import { getDemoReport, DEMO_AUDIT_ID } from "@/lib/demo/report";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatNumber, formatPercent, microsToCurrency, formatDate } from "@/lib/utils";
import type { AuditReport, ContentOpportunity, Recommendation, ScoreBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "summary", label: "Executive Summary", icon: FileText },
  { id: "leaks", label: "Top 5 Leaks", icon: AlertTriangle },
  { id: "seo", label: "SEO Foundation", icon: Search },
  { id: "technical", label: "Technical SEO", icon: Wrench },
  { id: "ai-search", label: "AI Search", icon: Sparkles },
  { id: "keywords", label: "Keyword Opportunities", icon: Zap },
  { id: "ppc", label: "PPC Review", icon: LayoutGrid },
  { id: "waste", label: "Ads Waste", icon: PiggyBank },
  { id: "landing", label: "Landing Pages", icon: MousePointerClick },
  { id: "tracking", label: "Tracking", icon: ShieldCheck },
  { id: "budget", label: "Budget", icon: Gauge },
  { id: "content", label: "Content Roadmap", icon: BookOpen },
  { id: "ab-tests", label: "A/B Tests", icon: FlaskConical },
  { id: "plan-30", label: "30-Day Plan", icon: CalendarCheck },
  { id: "plan-60", label: "60-Day Plan", icon: TrendingUp },
  { id: "plan-90", label: "90-Day Plan", icon: Rocket },
];

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = id === DEMO_AUDIT_ID ? await getDemoReport() : await getAudit(id);

  if (!report) return <NotFound />;
  if (report.status === "running" || report.status === "pending") redirect(`/audit/${id}`);
  if (report.status === "failed") return <FailedState report={report} />;

  const user = await getCurrentUser();
  const connected = report.auditMode !== "url_only";
  const recs = report.recommendations;
  const critical = recs.filter((r) => r.severity === "critical" || r.severity === "high");
  const top5 = [...recs].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 5);
  const byCategory = (...cats: string[]) => recs.filter((r) => cats.includes(r.category));

  const extra = report.breakdowns as Record<string, ScoreBreakdown>;
  const s = report.scores;
  const scoreBars = [
    { name: "SEO Foundation", score: s.seoFoundation },
    { name: "Technical SEO", score: s.technicalSeo },
    { name: "Content", score: s.contentQuality },
    { name: "Local", score: s.localVisibility },
    { name: "AI Search", score: s.aiSearchReadiness },
    { name: "PPC Efficiency", score: s.ppcEfficiency },
    { name: "Landing Page", score: s.landingPage },
    { name: "Tracking", score: s.conversionTracking },
    { name: "Measurement", score: s.measurementConfidence },
    { name: "Budget Waste", score: s.budgetWasteRisk, invert: true },
  ];

  const ctrData = report.adsRows.map((r) => ({ name: r.adGroupName ?? r.campaignName, ctr: r.ctr, impressions: r.impressions }));
  const spendData = report.adsRows.map((r) => ({
    name: r.adGroupName ?? r.campaignName,
    spend: Math.round(microsToCurrency(r.costMicros)),
    conversions: r.conversions,
  }));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card print:border-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="print:hidden">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Logo />
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={connected ? "info" : "secondary"}>
              {report.auditMode === "url_only" ? "URL-only audit" : report.auditMode === "full" ? "Full SEO + PPC audit" : "Connected data audit"}
            </Badge>
            <ReportToolbar
              recommendations={recs}
              executiveSummary={report.executiveSummary}
              businessName={report.businessName}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Search Funnel Audit</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{report.businessName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4" />
              <a href={report.websiteUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
                {report.websiteUrl}
              </a>
            </span>
            <span>
              {formatDate(report.dateStart)} – {formatDate(report.dateEnd)}
            </span>
            <span>Generated {formatDate(report.completedAt ?? report.createdAt)}</span>
          </div>
        </div>

        {/* Search Funnel Score hero */}
        <div id="score" className="mb-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">Search Funnel Score</p>
            <ScoreRing score={s.searchFunnel} size={160} stroke={14} />
            <p className="max-w-[240px] text-xs text-muted-foreground">
              Overall search-funnel health across SEO, PPC, landing pages, and measurement.
            </p>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Score breakdown</CardTitle>
              <CardDescription>Ten dimensions of SEO + paid search health (0–100).</CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreBarsChart data={scoreBars} />
            </CardContent>
          </Card>
        </div>

        {/* Score cards */}
        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <ScoreCard breakdown={extra.seoFoundation} />
          <ScoreCard breakdown={extra.technicalSeo} />
          <ScoreCard breakdown={extra.contentQuality} />
          <ScoreCard breakdown={extra.localVisibility} />
          <ScoreCard breakdown={extra.aiSearchReadiness} />
          <ScoreCard breakdown={extra.ppcEfficiency} />
          <ScoreCard breakdown={extra.landingPage} />
          <ScoreCard breakdown={extra.conversionTracking} />
          <ScoreCard breakdown={extra.measurementConfidence} />
          <ScoreCard breakdown={extra.budgetWasteRisk} invert />
        </div>

        {/* Section nav */}
        <nav className="mb-10 flex flex-wrap gap-2 print:hidden">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" /> {sec.label}
              </a>
            );
          })}
        </nav>

        <div className="space-y-12">
          {/* 1. Executive Summary */}
          <Section id="summary" icon={FileText} title="Executive Summary" badge="1">
            <Card>
              <CardContent className="space-y-4 p-6 text-sm leading-relaxed text-muted-foreground">
                {report.executiveSummary.split("\n\n").map((para, i) => (
                  <p key={i} className={para.startsWith("•") ? "pl-2 font-medium text-foreground" : ""}>
                    {para}
                  </p>
                ))}
                <p className="rounded-lg bg-muted/50 p-3 text-xs">
                  Recommendations are prioritized by <strong>impact × evidence confidence × urgency ÷ difficulty</strong>.
                  They are guidance based on observed signals — not guarantees of rankings or results.
                </p>
              </CardContent>
            </Card>
          </Section>

          {/* 2. Top 5 Critical Leaks */}
          <Section id="leaks" icon={AlertTriangle} title="Top 5 Critical Leaks" badge="2"
            subtitle="The highest-priority issues draining your search funnel.">
            {top5.length === 0 ? (
              <EmptyNote text="No major leaks detected." good />
            ) : (
              <div className="space-y-4">
                {top5.map((rec, i) => (
                  <RecommendationCard key={rec.id} rec={rec} index={i} />
                ))}
              </div>
            )}
          </Section>

          {/* 3. SEO Foundation */}
          <Section id="seo" icon={Search} title="SEO Foundation" badge="3"
            subtitle="Crawlability, indexability, structure, and search appearance.">
            <BreakdownPanel breakdown={extra.seoFoundation} />
            {report.siteSignals && <SiteSignalsCard report={report} />}
            {byCategory("seo", "local_seo").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </Section>

          {/* 4. Technical SEO */}
          <Section id="technical" icon={Wrench} title="Technical SEO" badge="4"
            subtitle="HTTPS, performance, mobile, canonical, and crawl health.">
            <BreakdownPanel breakdown={extra.technicalSeo} />
            {byCategory("technical_seo").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </Section>

          {/* 5. AI Search Readiness */}
          <Section id="ai-search" icon={Sparkles} title="AI Search Readiness" badge="5"
            subtitle="Built on strong fundamentals — not 'AEO/GEO hacks.'">
            <BreakdownPanel breakdown={extra.aiSearchReadiness} />
            <Card className="border-dashed">
              <CardContent className="p-5 text-sm text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">What we do NOT recommend</p>
                <ul className="grid gap-1.5 md:grid-cols-2">
                  {[
                    "Thin AI-generated pages for every query variation",
                    "Keyword stuffing or meta keywords",
                    "Updating dates without meaningful content changes",
                    "Creating llms.txt as if Google needs it",
                    "Chasing fake mentions or AI-only content rewrites",
                    "Overpromising AI Overview visibility",
                  ].map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400" />
                      {x}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            {byCategory("ai_search").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </Section>

          {/* 6. Keyword Opportunities */}
          <Section id="keywords" icon={Zap} title="Keyword Opportunities" badge="6"
            subtitle="Organic demand and search terms to capture in SEO + paid.">
            {extra.keyword && <BreakdownPanel breakdown={extra.keyword} />}
            {byCategory("organic_gap", "keyword_strategy").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
            {connected && report.searchConsoleRows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Search Console queries</CardTitle>
                  <CardDescription>Organic queries this site shows for.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Query</TableHead>
                        <TableHead className="text-right">Impr.</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">Position</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.searchConsoleRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.query}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.impressions)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.clicks)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPercent(r.ctr)}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.position.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </Section>

          {/* 7. PPC Campaign Review */}
          <Section id="ppc" icon={LayoutGrid} title="PPC Campaign Review" badge="7"
            subtitle="Account structure, efficiency, and ad relevance.">
            <BreakdownPanel breakdown={extra.ppcEfficiency} />
            {connected && report.adsRows.length > 0 ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">CTR by ad group</CardTitle>
                    <CardDescription>Red bars fall below the 2% local-search benchmark.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CtrByAdGroupChart data={ctrData} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ad group performance</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign / Ad group</TableHead>
                          <TableHead className="text-right">Impr.</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Conv.</TableHead>
                          <TableHead className="text-right">CPA</TableHead>
                          <TableHead className="text-right">QS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.adsRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="font-medium">{r.adGroupName}</div>
                              <div className="text-xs text-muted-foreground">{r.campaignName}</div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(r.impressions)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              <span className={r.ctr < 0.02 ? "text-red-600" : ""}>{formatPercent(r.ctr)}</span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(microsToCurrency(r.costMicros))}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.conversions}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.conversions > 0 ? formatCurrency(r.costPerConversion) : "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.qualityScore != null ? (
                                <span className={r.qualityScore <= 5 ? "text-red-600" : ""}>{r.qualityScore}/10</span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <ConnectNote />
            )}
            {byCategory("campaign_structure", "ad_copy", "bidding").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </Section>

          {/* 8. Google Ads Waste Analysis */}
          <Section id="waste" icon={PiggyBank} title="Google Ads Waste Analysis" badge="8"
            subtitle="Where spend is leaking on off-intent search terms.">
            <BreakdownPanel breakdown={extra.budgetWasteRisk} invert />
            {byCategory("negative_keywords").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
            {!connected && <ConnectNote />}
          </Section>

          {/* 9. Landing Page Conversion Review */}
          <Section id="landing" icon={MousePointerClick} title="Landing Page Conversion Review" badge="9"
            subtitle="Conversion readiness of the pages your traffic lands on.">
            <BreakdownPanel breakdown={extra.landingPage} />
            {byCategory("landing_page").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
            {report.crawledPages.length > 0 && <CrawledPagesTable report={report} />}
          </Section>

          {/* 10. Tracking + Measurement Review */}
          <Section id="tracking" icon={ShieldCheck} title="Tracking + Measurement Review" badge="10"
            subtitle="Whether your measurement can support smart bidding.">
            <BreakdownPanel breakdown={extra.conversionTracking} />
            <BreakdownPanel breakdown={extra.measurementConfidence} />
            {report.gtm ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">GTM container</CardTitle>
                    <CardDescription>{report.gtm.containerId}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <KV label="Tags" value={`${report.gtm.tags.length}`} />
                    <KV label="Triggers" value={`${report.gtm.triggers.length}`} />
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {report.gtm.tags.map((t) => (
                          <Badge key={t.tagId} variant="outline">{t.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Detected tracking gaps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {report.gtm.detectedTrackingIssues.map((issue, i) => (
                        <li key={i} className="flex gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          <span className="text-muted-foreground">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <ConnectNote text="Connect Google Tag Manager to inspect your tracking setup." />
            )}
            {byCategory("conversion_tracking", "measurement").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </Section>

          {/* 11. Budget Allocation Review */}
          <Section id="budget" icon={Gauge} title="Budget Allocation Review" badge="11"
            subtitle="Where spend is working — and where to reallocate.">
            {connected && spendData.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Spend vs. conversions</CardTitle>
                </CardHeader>
                <CardContent>
                  <SpendVsConversionsChart data={spendData} />
                </CardContent>
              </Card>
            ) : (
              <ConnectNote />
            )}
            {byCategory("budget_allocation").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </Section>

          {/* 12. Content Roadmap */}
          <Section id="content" icon={BookOpen} title="Content Roadmap" badge="12"
            subtitle="Substantive, people-first pages to build — never thin scaled pages.">
            {report.contentOpportunities.length === 0 ? (
              <EmptyNote text="No content gaps identified." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {report.contentOpportunities.map((c) => (
                  <ContentCard key={c.id} c={c} />
                ))}
              </div>
            )}
          </Section>

          {/* 13. A/B Testing Plan */}
          <Section id="ab-tests" icon={FlaskConical} title="A/B Testing Plan" badge="13"
            subtitle="Ready-to-run experiments, prioritized to your weakest areas.">
            <div className="grid gap-4 md:grid-cols-2">
              {report.abTests.map((t) => (
                <Card key={t.id}>
                  <CardHeader className="gap-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="info">{t.testType}</Badge>
                      <DifficultyBadge difficulty={t.difficulty} />
                    </div>
                    <CardTitle className="text-base">{t.testName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-muted-foreground">{t.hypothesis}</p>
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
                      <KV label="Control" value={t.control} stacked />
                      <KV label="Variant" value={t.variant} stacked />
                      <KV label="Primary metric" value={t.primaryMetric} stacked />
                      <KV label="Secondary" value={t.secondaryMetric} stacked />
                    </div>
                    <KV label="Success criteria" value={t.successCriteria} stacked />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>⏱ {t.minimumRuntime}</span>
                      <span>🛠 {t.recommendedTool}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>

          {/* 14-16. 30/60/90-day plans */}
          <Section id="plan-30" icon={CalendarCheck} title="Next 30-Day Action Plan" badge="14"
            subtitle="Stop the bleeding and ship quick wins.">
            <PlanGrid items={planPhase(recs, "30")} />
          </Section>
          <Section id="plan-60" icon={TrendingUp} title="60-Day Growth Plan" badge="15"
            subtitle="Build conversion-ready pages and tighten campaigns.">
            <PlanGrid items={planPhase(recs, "60")} contentItems={report.contentOpportunities.slice(0, 3)} />
          </Section>
          <Section id="plan-90" icon={Rocket} title="90-Day Scale Plan" badge="16"
            subtitle="Expand into proven demand with strong measurement in place.">
            <PlanGrid items={planPhase(recs, "90")} contentItems={report.contentOpportunities.slice(3, 6)} />
          </Section>
        </div>

        <Separator className="my-12" />
        <footer className="flex flex-col items-center gap-2 pb-8 text-center text-xs text-muted-foreground">
          <Logo />
          <p>Generated by funnl · {formatDate(report.completedAt ?? report.createdAt)}</p>
          <p className="max-w-md">
            Recommendations are based on observed signals and represent best-practice guidance, not guarantees of rankings or results.
          </p>
          {user && <p>Prepared for {user.email}</p>}
        </footer>
      </div>
    </div>
  );
}

// --- Local components ------------------------------------------------------

function Section({
  id,
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand-greenDark">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            <span className="mr-2 text-muted-foreground">{badge}</span>
            {title}
          </h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function BreakdownPanel({ breakdown, invert }: { breakdown?: ScoreBreakdown; invert?: boolean }) {
  if (!breakdown) return null;
  return (
    <Card>
      <CardContent className="grid gap-5 p-5 md:grid-cols-[140px_1fr]">
        <div className="flex flex-col items-center justify-center">
          <ScoreRing score={breakdown.score} invert={invert} size={110} label={breakdown.label} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {breakdown.issues.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Issues</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {breakdown.issues.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {breakdown.evidence.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {breakdown.evidence.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SiteSignalsCard({ report }: { report: AuditReport }) {
  const sig = report.siteSignals!;
  const rows: Array<[string, boolean]> = [
    ["HTTPS", sig.https],
    ["robots.txt present", sig.robotsTxtPresent],
    ["Not blocking crawl", !sig.robotsTxtBlocksAll],
    ["XML sitemap", sig.sitemapPresent],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Crawlability signals</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map(([label, ok]) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span className={ok ? "text-emerald-600" : "text-red-600"}>{ok ? "✓" : "✗"}</span>
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CrawledPagesTable({ report }: { report: AuditReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Crawled pages</CardTitle>
        <CardDescription>{report.crawledPages.length} pages analyzed.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Form</TableHead>
              <TableHead className="text-center">Phone</TableHead>
              <TableHead className="text-right">Words</TableHead>
              <TableHead className="text-right">Mobile</TableHead>
              <TableHead className="text-right">Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.crawledPages.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-[240px] truncate font-medium">
                  <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                    {p.title ?? p.url}
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                  </a>
                </TableCell>
                <TableCell className="capitalize">{p.pageType}</TableCell>
                <TableCell className="text-center">{p.forms.length > 0 ? "✓" : "—"}</TableCell>
                <TableCell className="text-center">{p.phoneLinks.length > 0 ? "✓" : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={p.wordCount < 250 ? "text-amber-600" : ""}>{p.wordCount}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.mobileScore != null ? <span className={p.mobileScore < 50 ? "text-red-600" : ""}>{p.mobileScore}</span> : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.issues.length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ContentCard({ c }: { c: ContentOpportunity }) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="capitalize">{c.pageType.replace("_", " ")}</Badge>
          <Badge variant="info" className="capitalize">{c.searchIntent}</Badge>
        </div>
        <CardTitle className="text-base">{c.title}</CardTitle>
        <CardDescription className="font-mono text-xs">{c.slug}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{c.userProblem}</p>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required sections</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {c.requiredSections.slice(0, 5).map((sct, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                {sct}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {c.queryCluster.slice(0, 4).map((q) => (
            <Badge key={q} variant="secondary" className="font-normal">{q}</Badge>
          ))}
        </div>
        <div className="grid gap-1 rounded-lg bg-muted/40 p-3 text-xs">
          <KV label="CTA" value={c.suggestedCta} stacked />
          <KV label="Structured data" value={c.structuredDataRecommendation} stacked />
          <KV label="PPC relevance" value={c.ppcRelevance} stacked />
        </div>
      </CardContent>
    </Card>
  );
}

function KV({ label, value, stacked }: { label: string; value: string; stacked?: boolean }) {
  if (stacked) {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-foreground">{value}</p>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between border-b pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function planPhase(recs: Recommendation[], phase: "30" | "60" | "90"): Recommendation[] {
  const sorted = [...recs].sort((a, b) => b.priorityScore - a.priorityScore);
  if (phase === "30") return sorted.filter((r) => r.urgency === "now").slice(0, 6);
  if (phase === "60") return sorted.filter((r) => r.urgency === "soon").slice(0, 6);
  return sorted.filter((r) => r.urgency === "later").slice(0, 6);
}

function PlanGrid({ items, contentItems }: { items: Recommendation[]; contentItems?: ContentOpportunity[] }) {
  if (items.length === 0 && (!contentItems || contentItems.length === 0)) {
    return <EmptyNote text="No items scheduled for this phase — keep monitoring." />;
  }
  return (
    <Card>
      <CardContent className="p-5">
        <ol className="space-y-2.5 text-sm">
          {items.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5">
              <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium">{r.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">({r.category.replace(/_/g, " ")} · priority {r.priorityScore})</span>
              </span>
            </li>
          ))}
          {contentItems?.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
              <span>
                <span className="font-medium">Publish: {c.title}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{c.slug}</span>
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function EmptyNote({ text, good }: { text: string; good?: boolean }) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-sm text-muted-foreground">
        {good ? "✅ " : ""}
        {text}
      </CardContent>
    </Card>
  );
}

function ConnectNote({ text }: { text?: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {text ?? "This section is richer with connected data. Connect Google Ads, GA4, Search Console & GTM for full diagnostics."}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/integrations">Connect Google</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <Logo />
      <h1 className="text-2xl font-bold">Report not found</h1>
      <p className="max-w-md text-muted-foreground">
        This audit doesn&apos;t exist or has expired. Run a new audit or view the demo report.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/audit/new">Run new audit</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/reports/demo">View demo report</Link>
        </Button>
      </div>
    </div>
  );
}

function FailedState({ report }: { report: AuditReport }) {
  const message =
    report.error === "CRAWL_FAILED"
      ? "We couldn't crawl that website. Make sure the URL is publicly reachable."
      : report.error === "INVALID_URL"
        ? "That URL looks invalid."
        : "The audit failed partway through. Please try again.";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <h1 className="text-2xl font-bold">Audit failed</h1>
      <p className="max-w-md text-muted-foreground">{message}</p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/audit/new">Try again</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/reports/demo">View demo report</Link>
        </Button>
      </div>
    </div>
  );
}
