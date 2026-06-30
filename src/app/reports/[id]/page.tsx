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
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  microsToCurrency,
  formatDate,
} from "@/lib/utils";
import type { AuditReport, ScoreBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "summary", label: "Executive Summary", icon: FileText },
  { id: "critical", label: "Critical Issues", icon: AlertTriangle },
  { id: "quick-wins", label: "Quick Wins", icon: Zap },
  { id: "keywords", label: "Keyword Opportunities", icon: Search },
  { id: "structure", label: "Campaign Structure", icon: LayoutGrid },
  { id: "ad-copy", label: "Ad Copy", icon: PenLine },
  { id: "landing", label: "Landing Pages", icon: MousePointerClick },
  { id: "tracking", label: "Conversion Tracking", icon: ShieldCheck },
  { id: "budget", label: "Budget Allocation", icon: PiggyBank },
  { id: "ab-tests", label: "A/B Testing Plan", icon: FlaskConical },
  { id: "action-plan", label: "30-Day Action Plan", icon: CalendarCheck },
];

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = id === DEMO_AUDIT_ID ? await getDemoReport() : await getAudit(id);

  if (!report) {
    return <NotFound />;
  }
  // If the audit is still running, send the user to the live progress page.
  if (report.status === "running" || report.status === "pending") {
    redirect(`/audit/${id}`);
  }
  if (report.status === "failed") {
    return <FailedState report={report} />;
  }

  const user = await getCurrentUser();
  const connected = report.auditMode === "connected";
  const recs = report.recommendations;
  const critical = recs.filter((r) => r.severity === "critical" || r.severity === "high");
  const quickWins = recs.filter((r) => r.difficulty === "easy").slice(0, 8);
  const byCategory = (cat: string) => recs.filter((r) => r.category === cat);

  const extra = report.breakdowns as Record<string, ScoreBreakdown>;
  const scoreBars = [
    { name: "Paid Search", score: report.scores.paidSearch },
    { name: "Landing Page", score: report.scores.landingPage },
    { name: "Tracking", score: report.scores.tracking },
    { name: "Keyword Opp.", score: report.scores.keyword },
    { name: "Budget Waste", score: report.scores.budgetWaste, invert: true },
  ];

  const ctrData = report.adsRows.map((r) => ({
    name: r.adGroupName ?? r.campaignName,
    ctr: r.ctr,
    impressions: r.impressions,
  }));
  const spendData = report.adsRows.map((r) => ({
    name: r.adGroupName ?? r.campaignName,
    spend: Math.round(microsToCurrency(r.costMicros)),
    conversions: r.conversions,
  }));

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
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
              {connected ? "Connected data audit" : "URL-only audit"}
            </Badge>
            <ReportToolbar />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {/* Title block */}
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">SEM Diagnostic Report</p>
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

        {/* Score hero */}
        <div className="mb-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">Overall SEM Readiness</p>
            <ScoreRing score={report.scores.overall} size={160} stroke={14} />
            <p className="max-w-[240px] text-xs text-muted-foreground">
              Weighted across {connected ? "all six" : "landing page, tracking & keyword"} dimensions.
            </p>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Score breakdown</CardTitle>
              <CardDescription>Six dimensions of paid search readiness (0–100).</CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreBarsChart data={scoreBars} />
            </CardContent>
          </Card>
        </div>

        {/* Score cards */}
        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <ScoreCard breakdown={extra.paidSearch} />
          <ScoreCard breakdown={extra.landingPage} />
          <ScoreCard breakdown={extra.tracking} />
          <ScoreCard breakdown={extra.keyword} />
          <ScoreCard breakdown={extra.budgetWaste} invert />
        </div>

        {/* Section nav */}
        <nav className="mb-10 flex flex-wrap gap-2 print:hidden">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" /> {s.label}
              </a>
            );
          })}
        </nav>

        <div className="space-y-12">
          {/* 1. Executive Summary */}
          <Section id="summary" icon={FileText} title="Executive Summary" badge="1">
            <Card>
              <CardContent className="prose-sm space-y-4 p-6 text-sm leading-relaxed text-muted-foreground">
                {report.executiveSummary.split("\n\n").map((para, i) => (
                  <p key={i} className={para.startsWith("•") ? "pl-2 font-medium text-foreground" : ""}>
                    {para}
                  </p>
                ))}
              </CardContent>
            </Card>
          </Section>

          {/* 2. Critical Issues */}
          <Section id="critical" icon={AlertTriangle} title="Critical Issues" badge="2"
            subtitle="High-severity problems to fix before increasing spend.">
            {critical.length === 0 ? (
              <EmptyNote text="No critical or high-severity issues detected. Nice work." good />
            ) : (
              <div className="space-y-4">
                {critical.map((rec, i) => (
                  <RecommendationCard key={rec.id} rec={rec} index={i} />
                ))}
              </div>
            )}
          </Section>

          {/* 3. Quick Wins */}
          <Section id="quick-wins" icon={Zap} title="Quick Wins" badge="3"
            subtitle="Low-effort, high-leverage changes you can ship this week.">
            {quickWins.length === 0 ? (
              <EmptyNote text="No quick wins identified in this audit." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {quickWins.map((rec) => (
                  <Card key={rec.id}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={rec.severity} />
                        <DifficultyBadge difficulty={rec.difficulty} />
                      </div>
                      <p className="font-medium">{rec.title}</p>
                      <p className="text-sm text-muted-foreground">{rec.recommendedFix}</p>
                      <p className="text-xs text-primary">{rec.estimatedImpact}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          {/* 4. Keyword Opportunities */}
          <Section id="keywords" icon={Search} title="Keyword Opportunities" badge="4"
            subtitle="Organic demand and search terms you should be capturing in paid.">
            <BreakdownPanel breakdown={extra.keyword} />
            {byCategory("organic_gap").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
            {byCategory("keyword_strategy").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
            {connected && report.searchConsoleRows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Search Console queries</CardTitle>
                  <CardDescription>Organic queries this site is showing for.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Query</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">Avg. Position</TableHead>
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

          {/* 5. Campaign Structure Review */}
          <Section id="structure" icon={LayoutGrid} title="Campaign Structure Review" badge="5"
            subtitle="How your campaigns and ad groups are organized.">
            {extra.campaignStructure && <BreakdownPanel breakdown={extra.campaignStructure} />}
            {connected && report.adsRows.length > 0 ? (
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
                          <TableCell className="text-right tabular-nums">
                            {r.conversions > 0 ? formatCurrency(r.costPerConversion) : "—"}
                          </TableCell>
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
            ) : (
              <ConnectNote />
            )}
            {byCategory("campaign_structure").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </Section>

          {/* 6. Ad Copy Recommendations */}
          <Section id="ad-copy" icon={PenLine} title="Ad Copy Recommendations" badge="6"
            subtitle="Where the ad message isn't earning the click.">
            {connected && ctrData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">CTR by ad group</CardTitle>
                  <CardDescription>Red bars fall below the 2% local-search benchmark.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CtrByAdGroupChart data={ctrData} />
                </CardContent>
              </Card>
            )}
            {byCategory("ad_copy").length === 0 ? (
              <EmptyNote text={connected ? "No ad-copy issues flagged." : "Connect Google Ads to analyze ad copy performance."} />
            ) : (
              byCategory("ad_copy").map((rec, i) => <RecommendationCard key={rec.id} rec={rec} index={i} />)
            )}
          </Section>

          {/* 7. Landing Page Recommendations */}
          <Section id="landing" icon={MousePointerClick} title="Landing Page Recommendations" badge="7"
            subtitle="Conversion readiness of the pages paid traffic lands on.">
            <BreakdownPanel breakdown={extra.landingPage} />
            {byCategory("landing_page").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
            {report.crawledPages.length > 0 && (
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
                        <TableHead className="text-right">Mobile</TableHead>
                        <TableHead className="text-right">Issues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.crawledPages.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="max-w-[260px] truncate font-medium">
                            <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                              {p.title ?? p.url}
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                            </a>
                          </TableCell>
                          <TableCell className="capitalize">{p.pageType}</TableCell>
                          <TableCell className="text-center">{p.forms.length > 0 ? "✓" : "—"}</TableCell>
                          <TableCell className="text-center">{p.phoneLinks.length > 0 ? "✓" : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.mobileScore != null ? (
                              <span className={p.mobileScore < 50 ? "text-red-600" : ""}>{p.mobileScore}</span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{p.issues.length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </Section>

          {/* 8. Conversion Tracking Review */}
          <Section id="tracking" icon={ShieldCheck} title="Conversion Tracking Review" badge="8"
            subtitle="Whether your measurement can support smart bidding.">
            <BreakdownPanel breakdown={extra.tracking} />
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
                    <KV label="Variables" value={`${report.gtm.variables.length}`} />
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
            {byCategory("conversion_tracking").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </Section>

          {/* 9. Budget Allocation Review */}
          <Section id="budget" icon={PiggyBank} title="Budget Allocation Review" badge="9"
            subtitle="Where spend is working — and where it's leaking.">
            <BreakdownPanel breakdown={extra.budgetWaste} invert />
            {connected && spendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Spend vs. conversions</CardTitle>
                </CardHeader>
                <CardContent>
                  <SpendVsConversionsChart data={spendData} />
                </CardContent>
              </Card>
            )}
            {byCategory("budget_allocation").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
            {byCategory("negative_keywords").map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
            {!connected && <ConnectNote />}
          </Section>

          {/* 10. A/B Testing Plan */}
          <Section id="ab-tests" icon={FlaskConical} title="A/B Testing Plan" badge="10"
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
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>⏱ {t.minimumRuntime}</span>
                      <span>🛠 {t.recommendedTool}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>

          {/* 11. 30-Day Action Plan */}
          <Section id="action-plan" icon={CalendarCheck} title="Next 30-Day Action Plan" badge="11"
            subtitle="Your prioritized roadmap, sequenced into four weeks.">
            <ActionPlan report={report} />
          </Section>
        </div>

        <Separator className="my-12" />
        <footer className="flex flex-col items-center gap-2 pb-8 text-center text-xs text-muted-foreground">
          <Logo />
          <p>Generated by SEM Command Center · {formatDate(report.completedAt ?? report.createdAt)}</p>
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

function BreakdownPanel({ breakdown, invert }: { breakdown: ScoreBreakdown; invert?: boolean }) {
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

function ActionPlan({ report }: { report: AuditReport }) {
  const sorted = [...report.recommendations].sort((a, b) => b.priorityScore - a.priorityScore);
  const weeks = [
    { title: "Week 1 — Stop the bleeding", items: sorted.filter((r) => r.severity === "critical").slice(0, 4) },
    { title: "Week 2 — Quick wins", items: sorted.filter((r) => r.difficulty === "easy" && r.severity !== "critical").slice(0, 4) },
    { title: "Week 3 — Landing pages & tracking", items: sorted.filter((r) => ["landing_page", "conversion_tracking"].includes(r.category)).slice(0, 4) },
    { title: "Week 4 — Structure & expansion", items: sorted.filter((r) => ["campaign_structure", "keyword_strategy", "organic_gap"].includes(r.category)).slice(0, 4) },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {weeks.map((w, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="text-base">{w.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {w.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Continue monitoring; no blocking items this week.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {w.items.map((r) => (
                  <li key={r.id} className="flex gap-2">
                    <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{r.title}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
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
