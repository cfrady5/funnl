import Link from "next/link";
import {
  PlusCircle,
  PlugZap,
  AlertTriangle,
  Building2,
  Gauge,
  ArrowRight,
  FileSearch,
  Keyboard,
} from "lucide-react";
import { AppShell } from "@/components/nav/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreRing, scoreColor } from "@/components/ui/score-ring";
import { getCurrentUser } from "@/lib/auth";
import { listAudits, listBusinesses } from "@/lib/store";
import { listIntegrations } from "@/lib/integrations";
import { DEMO_MODE } from "@/lib/config";
import { formatDate, relativeTime } from "@/lib/utils";
import type { AuditMode, AuditStatus } from "@/lib/types";

function modeBadge(mode: AuditMode) {
  switch (mode) {
    case "connected":
    case "full":
      return <Badge variant="success">Connected</Badge>;
    case "manual":
      return <Badge variant="info">Manual data</Badge>;
    default:
      return <Badge variant="secondary">URL only</Badge>;
  }
}

function statusBadge(status: AuditStatus) {
  switch (status) {
    case "completed":
      return <Badge variant="success">Completed</Badge>;
    case "running":
      return <Badge variant="info">Running</Badge>;
    case "failed":
      return <Badge variant="critical">Failed</Badge>;
    default:
      return <Badge variant="low">Pending</Badge>;
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const audits = await listAudits(user?.id ?? null);
  const businesses = await listBusinesses(user?.id ?? null);
  const integrations = listIntegrations(user?.id ?? "anonymous");

  const averageScore =
    audits.length > 0
      ? Math.round(
          audits.reduce((sum, a) => sum + a.overallScore, 0) / audits.length,
        )
      : 0;
  const criticalIssues = audits.reduce((sum, a) => sum + a.criticalCount, 0);
  const connectedIntegrations = integrations.filter(
    (i) => i.status === "connected",
  ).length;

  // Most recent audit (audits are returned newest-first by the store).
  const latestAudit = audits[0] ?? null;
  // A small sparkline of recent Search Funnel Scores — oldest to newest, left
  // to right. We only use overallScore (which we have per audit).
  const recentScores = audits.slice(0, 12).map((a) => a.overallScore).reverse();

  return (
    <AppShell demoMode={DEMO_MODE} userEmail={user?.email}>
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your search funnel at a glance — scores, issues, and connected data.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/audit/new">
                <PlusCircle /> Start Audit
              </Link>
            </Button>
          </div>
        </div>

        {/* Empty state — shown only before the first audit */}
        {audits.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-5 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-brand-blueDark">
                <FileSearch className="h-8 w-8" />
              </div>
              <div className="max-w-md">
                <p className="text-lg font-semibold">
                  Run your first audit to find the leaks in your search funnel.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start with just a URL, or enter your own numbers manually — no
                  Google access required.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg">
                  <Link href="/audit/new">
                    <PlusCircle /> Start Audit
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Average Search Funnel Score
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {audits.length > 0
                    ? `Across ${audits.length} audit${audits.length === 1 ? "" : "s"}`
                    : "No audits yet"}
                </p>
              </div>
              {audits.length > 0 ? (
                <ScoreRing score={averageScore} size={64} stroke={7} />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Gauge className="h-6 w-6" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Audits run
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  {audits.length}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <FileSearch className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Critical recommendations
                </p>
                <p
                  className="mt-1 text-3xl font-bold tabular-nums"
                  style={{ color: criticalIssues > 0 ? "#EF4444" : "#22C55E" }}
                >
                  {criticalIssues}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Connected Integrations
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  {connectedIntegrations}
                  <span className="text-base font-medium text-muted-foreground">
                    {" "}
                    / 4
                  </span>
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <PlugZap className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Businesses Monitored
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  {businesses.length}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-brand-blueDark">
                <Building2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend + top recommendations */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search Funnel Score trend</CardTitle>
              <CardDescription>
                Recent audits&apos; overall scores, oldest to newest.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentScores.length > 0 ? (
                <div className="flex h-24 items-end gap-1.5">
                  {recentScores.map((score, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${Math.max(6, score)}%`,
                        backgroundColor: scoreColor(score),
                      }}
                      title={`Score: ${score}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  Run an audit to start tracking your trend.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top recommendations</CardTitle>
              <CardDescription>
                Your prioritized fixes live inside each report.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latestAudit ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Your most recent audit for{" "}
                    <span className="font-medium text-foreground">
                      {latestAudit.businessName}
                    </span>{" "}
                    has{" "}
                    {latestAudit.criticalCount > 0 ? (
                      <span className="font-semibold text-red-600">
                        {latestAudit.criticalCount} critical issue
                        {latestAudit.criticalCount === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="font-medium text-foreground">
                        no critical issues
                      </span>
                    )}{" "}
                    to review.
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <Link href={`/reports/${latestAudit.id}`}>
                      View prioritized recommendations
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recommendations yet. Run your first audit to see exactly
                  where your search funnel is leaking and what to fix first.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link href="/audit/new" className="group">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-brand-blueDark">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <CardTitle className="flex items-center justify-between">
                  Start Audit
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardTitle>
                <CardDescription>
                  Score a website&apos;s entire search funnel in minutes.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/audit/new" className="group">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Keyboard className="h-5 w-5" />
                </div>
                <CardTitle className="flex items-center justify-between">
                  Manual data audit
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardTitle>
                <CardDescription>
                  No Google access? Enter your numbers manually for a stronger
                  report.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Recent audits */}
        <Card>
          <CardHeader>
            <CardTitle>Recent audits</CardTitle>
            <CardDescription>
              Your latest Search Funnel reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {audits.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-brand-blueDark">
                  <FileSearch className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-semibold">No audits yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Run your first audit to find the leaks in your search funnel.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild>
                    <Link href="/audit/new">
                      <PlusCircle /> Start Audit
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Critical</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Report</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell>
                        <div className="font-medium">{audit.businessName}</div>
                        <div className="text-xs text-muted-foreground">
                          {audit.websiteUrl}
                        </div>
                      </TableCell>
                      <TableCell>{modeBadge(audit.auditMode)}</TableCell>
                      <TableCell>{statusBadge(audit.status)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className="font-bold tabular-nums"
                          style={{ color: scoreColor(audit.overallScore) }}
                        >
                          {audit.overallScore}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {audit.criticalCount > 0 ? (
                          <span className="font-semibold text-red-600">
                            {audit.criticalCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-sm"
                          title={formatDate(audit.createdAt)}
                        >
                          {relativeTime(audit.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="link" size="sm">
                          <Link href={`/reports/${audit.id}`}>
                            View report
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
