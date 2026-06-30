import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Zap,
  Clock,
  ArrowLeft,
  Globe,
  ExternalLink,
  Droplets,
  Trophy,
  ShieldAlert,
  CalendarCheck,
  BookOpen,
  FlaskConical,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreRing } from "@/components/ui/score-ring";
import { RecItem } from "@/components/report/rec-item";
import { DifficultyBadge } from "@/components/report/severity-badge";
import { ReportToolbar } from "@/components/report/report-toolbar";
import { SpendVsConversionsChart, ScoreBarsChart } from "@/components/report/charts";
import { Logo } from "@/components/logo";
import { getAudit } from "@/lib/store";
import { getDemoReport, DEMO_AUDIT_ID } from "@/lib/demo/report";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatNumber, formatPercent, microsToCurrency, formatDate, cn } from "@/lib/utils";
import type { AuditReport, ContentOpportunity, Recommendation, ScoreBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

function plainLabel(score: number, invert = false): { text: string; cls: string } {
  const s = invert ? 100 - score : score;
  if (s >= 75) return { text: "Strong", cls: "text-emerald-600" };
  if (s >= 55) return { text: "Needs Work", cls: "text-amber-600" };
  if (s >= 40) return { text: "Weak", cls: "text-orange-600" };
  return { text: "Critical", cls: "text-red-600" };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = id === DEMO_AUDIT_ID ? await getDemoReport() : await getAudit(id);

  if (!report) return <NotFound />;
  if (report.status === "running" || report.status === "pending") redirect(`/audit/${id}`);
  if (report.status === "failed") return <FailedState report={report} />;

  const user = await getCurrentUser();
  const connected = report.auditMode !== "url_only";
  const recs = report.recommendations;
  const groups = {
    critical: recs.filter((r) => r.group === "critical"),
    eventually: recs.filter((r) => r.group === "eventually"),
    easy: recs.filter((r) => r.group === "easy"),
  };

  const extra = report.breakdowns as Record<string, ScoreBreakdown>;
  const s = report.scores;
  const modeLabel =
    report.auditMode === "url_only"
      ? "Website-only audit"
      : report.auditMode === "manual"
        ? "Manual analytics audit"
        : report.auditMode === "full"
          ? "Full SEO + PPC audit"
          : "Connected data audit";

  const snapshot = [
    { name: "SEO Foundation", score: s.seoFoundation },
    { name: "Paid Search Efficiency", score: s.ppcEfficiency },
    { name: "Landing Page Quality", score: s.landingPage },
    { name: "Conversion Tracking", score: s.conversionTracking },
    { name: "Local Visibility", score: s.localVisibility },
    { name: "AI Search Readiness", score: s.aiSearchReadiness },
  ];

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

  const spendData = report.adsRows.map((r) => ({
    name: r.adGroupName ?? r.campaignName,
    spend: Math.round(microsToCurrency(r.costMicros)),
    conversions: r.conversions,
  }));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card print:border-0">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="print:hidden">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <Logo />
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={connected ? "info" : "secondary"}>{modeLabel}</Badge>
            <ReportToolbar recommendations={recs} executiveSummary={report.executiveSummary} businessName={report.businessName} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        {/* --- Top summary --- */}
        <div className="mb-6">
          <p className="text-sm font-medium text-primary">Search Funnel Audit</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{report.businessName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4" />
              <a href={report.websiteUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">{report.websiteUrl}</a>
            </span>
            <span>{formatDate(report.completedAt ?? report.createdAt)}</span>
            {report.manualInput && <Badge variant="outline">Based on your reported data</Badge>}
          </div>
        </div>

        <Card className="mb-6 overflow-hidden">
          <CardContent className="grid gap-6 p-6 md:grid-cols-[200px_1fr]">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <ScoreRing score={s.searchFunnel} size={150} stroke={13} />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Search Funnel Score</p>
            </div>
            <div className="flex flex-col justify-center gap-4">
              <p className="text-lg font-medium leading-snug">{report.summary.diagnosis}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryTile icon={Droplets} label="Main leak" value={report.summary.mainLeak} tone="amber" />
                <SummaryTile icon={Trophy} label="Best quick win" value={report.summary.bestQuickWin} tone="green" />
                <SummaryTile icon={ShieldAlert} label="Biggest risk" value={report.summary.biggestRisk} tone="red" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* --- Score snapshot --- */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Score snapshot</h2>
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {snapshot.map((c) => {
            const lab = plainLabel(c.score);
            return (
              <Card key={c.name}>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold tabular-nums" style={{ color: undefined }}>{c.score}</div>
                  <div className={cn("text-xs font-semibold", lab.cls)}>{lab.text}</div>
                  <div className="mt-1 text-[11px] leading-tight text-muted-foreground">{c.name}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* --- Executive summary --- */}
        <Card className="mb-10">
          <CardHeader><CardTitle className="text-base">Executive summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {report.executiveSummary.split("\n\n").map((p, i) => (
              <p key={i} className={p.startsWith("•") ? "pl-2 font-medium text-foreground" : ""}>{p}</p>
            ))}
          </CardContent>
        </Card>

        {/* --- Recommendation groups --- */}
        <div className="space-y-10">
          <RecGroup
            id="critical"
            icon={AlertTriangle}
            title="Critical"
            tone="red"
            subtitle="Issues that block measurement, waste budget, prevent conversions, or seriously limit visibility. Fix these before spending more."
            recs={groups.critical}
            emptyText="No critical blockers found — great. Focus on the sections below."
          />
          <RecGroup
            id="easy"
            icon={Zap}
            title="Easiest to Fix"
            tone="green"
            subtitle="Low-effort, high-clarity changes you can ship this week."
            recs={groups.easy}
            emptyText="No quick wins identified in this audit."
          />
          <RecGroup
            id="eventually"
            icon={Clock}
            title="Needs Done Eventually"
            tone="amber"
            subtitle="Valuable, strategic improvements that aren't immediate blockers."
            recs={groups.eventually}
            emptyText="Nothing queued here right now."
          />
        </div>

        {/* --- 30-day action plan --- */}
        <section id="plan" className="mt-12 scroll-mt-24">
          <SectionHeader icon={CalendarCheck} title="30-Day Action Plan" subtitle="A clear week-by-week sequence." />
          <div className="grid gap-4 md:grid-cols-2">
            <PlanWeek title="Week 1 — Tracking & critical fixes" items={pickWeek(recs, 1)} />
            <PlanWeek title="Week 2 — Landing page & CTA fixes" items={pickWeek(recs, 2)} />
            <PlanWeek title="Week 3 — Campaign & keyword fixes" items={pickWeek(recs, 3)} />
            <PlanWeek title="Week 4 — Content & optimization" items={pickWeek(recs, 4)} />
          </div>
        </section>

        {/* --- Detailed findings (secondary) --- */}
        <section className="mt-12">
          <SectionHeader icon={ClipboardList} title="Detailed findings & data" subtitle="The full breakdown behind the scores above." />

          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">All ten dimensions</CardTitle></CardHeader>
            <CardContent><ScoreBarsChart data={scoreBars} /></CardContent>
          </Card>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <BreakdownPanel breakdown={extra.seoFoundation} />
            <BreakdownPanel breakdown={extra.technicalSeo} />
            <BreakdownPanel breakdown={extra.landingPage} />
            <BreakdownPanel breakdown={extra.conversionTracking} />
            <BreakdownPanel breakdown={extra.aiSearchReadiness} />
            <BreakdownPanel breakdown={extra.localVisibility} />
          </div>

          {connected && report.adsRows.length > 0 && (
            <Card className="mb-6">
              <CardHeader><CardTitle className="text-base">Paid search performance</CardTitle></CardHeader>
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
                        <TableCell className="text-right tabular-nums"><span className={r.ctr < 0.02 ? "text-red-600" : ""}>{formatPercent(r.ctr)}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(microsToCurrency(r.costMicros))}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.conversions}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.conversions > 0 ? formatCurrency(r.costPerConversion) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {connected && spendData.length > 0 && (
            <Card className="mb-6">
              <CardHeader><CardTitle className="text-base">Spend vs. conversions</CardTitle></CardHeader>
              <CardContent><SpendVsConversionsChart data={spendData} /></CardContent>
            </Card>
          )}

          {connected && report.searchConsoleRows.length > 0 && (
            <Card className="mb-6">
              <CardHeader><CardTitle className="text-base">Organic search queries</CardTitle></CardHeader>
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

          {report.crawledPages.length > 0 && (
            <Card className="mb-6">
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
                      <TableHead className="text-right">Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.crawledPages.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[240px] truncate font-medium">
                          <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                            {p.title ?? p.url}<ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                          </a>
                        </TableCell>
                        <TableCell className="capitalize">{p.pageType}</TableCell>
                        <TableCell className="text-center">{p.forms.length > 0 ? "✓" : "—"}</TableCell>
                        <TableCell className="text-center">{p.phoneLinks.length > 0 ? "✓" : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums"><span className={p.wordCount < 250 ? "text-amber-600" : ""}>{p.wordCount}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{p.issues.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {report.contentOpportunities.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4 text-primary" /> Content roadmap</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {report.contentOpportunities.map((c) => <ContentCard key={c.id} c={c} />)}
              </div>
            </div>
          )}

          {report.abTests.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><FlaskConical className="h-4 w-4 text-primary" /> A/B testing plan</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {report.abTests.slice(0, 6).map((t) => (
                  <Card key={t.id}>
                    <CardHeader className="gap-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="info">{t.testType}</Badge>
                        <DifficultyBadge difficulty={t.difficulty} />
                      </div>
                      <CardTitle className="text-base">{t.testName}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>{t.hypothesis}</p>
                      <p className="text-xs"><span className="font-medium text-foreground">Success:</span> {t.successCriteria}</p>
                      <p className="text-xs">⏱ {t.minimumRuntime}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </section>

        <Separator className="my-12" />
        <footer className="flex flex-col items-center gap-2 pb-8 text-center text-xs text-muted-foreground">
          <Logo />
          <p>Generated by funnl · {formatDate(report.completedAt ?? report.createdAt)}</p>
          <p className="max-w-md">Recommendations are based on observed signals and represent best-practice guidance, not guarantees of rankings or results.</p>
          {user && <p>Prepared for {user.email}</p>}
        </footer>
      </div>
    </div>
  );
}

// --- Local components ------------------------------------------------------

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  tone: "amber" | "green" | "red";
}) {
  const toneCls = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-amber-600";
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className={cn("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide", toneCls)}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm font-medium leading-snug">{value ?? "—"}</p>
    </div>
  );
}

function RecGroup({
  id,
  icon: Icon,
  title,
  subtitle,
  tone,
  recs,
  emptyText,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  tone: "red" | "green" | "amber";
  recs: Recommendation[];
  emptyText: string;
}) {
  const toneRing = tone === "red" ? "bg-red-100 text-red-700" : tone === "green" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneRing)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight">
            {title} <span className="ml-1 text-base font-medium text-muted-foreground">({recs.length})</span>
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {recs.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{emptyText}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {recs.map((r) => <RecItem key={r.id} rec={r} />)}
        </div>
      )}
    </section>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand-greenDark">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function BreakdownPanel({ breakdown }: { breakdown?: ScoreBreakdown }) {
  if (!breakdown) return null;
  const lab = plainLabel(breakdown.score, breakdown.label === "Budget Waste Risk");
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold">{breakdown.label}</p>
          <span className={cn("text-sm font-semibold", lab.cls)}>{breakdown.score} · {lab.text}</span>
        </div>
        {breakdown.issues.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {breakdown.issues.slice(0, 4).map((x, i) => (
              <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400" />{x}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-600">No issues detected.</p>
        )}
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
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>{c.userProblem}</p>
        <p className="text-xs"><span className="font-medium text-foreground">CTA:</span> {c.suggestedCta}</p>
        <p className="text-xs"><span className="font-medium text-foreground">PPC:</span> {c.ppcRelevance}</p>
      </CardContent>
    </Card>
  );
}

function PlanWeek({ title, items }: { title: string; items: Recommendation[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keep monitoring — nothing blocking this week.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {items.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{r.title}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Sequence recommendations into 4 weeks by group + category. */
function pickWeek(recs: Recommendation[], week: 1 | 2 | 3 | 4): Recommendation[] {
  const byPriority = [...recs].sort((a, b) => b.priorityScore - a.priorityScore);
  if (week === 1) {
    return byPriority.filter((r) => r.group === "critical" || r.category === "conversion_tracking" || r.category === "measurement").slice(0, 4);
  }
  if (week === 2) {
    return byPriority.filter((r) => r.category === "landing_page" || r.category === "ad_copy").slice(0, 4);
  }
  if (week === 3) {
    return byPriority.filter((r) => ["campaign_structure", "negative_keywords", "keyword_strategy", "bidding", "budget_allocation"].includes(r.category)).slice(0, 4);
  }
  return byPriority.filter((r) => ["content", "seo", "technical_seo", "local_seo", "ai_search", "organic_gap"].includes(r.category)).slice(0, 4);
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <Logo />
      <h1 className="text-2xl font-bold">Report not found</h1>
      <p className="max-w-md text-muted-foreground">This audit doesn&apos;t exist or has expired. Start a new audit or view the sample report.</p>
      <div className="flex gap-3">
        <Button asChild><Link href="/audit/new">Start Audit</Link></Button>
        <Button asChild variant="outline"><Link href="/reports/demo">View Sample Report</Link></Button>
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
        <Button asChild><Link href="/audit/new">Try again</Link></Button>
        <Button asChild variant="outline"><Link href="/reports/demo">View Sample Report</Link></Button>
      </div>
    </div>
  );
}
