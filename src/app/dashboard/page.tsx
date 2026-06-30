import Link from "next/link";
import {
  PlusCircle,
  PlugZap,
  Sparkles,
  AlertTriangle,
  Building2,
  Gauge,
  ArrowRight,
  FileSearch,
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
  return mode === "connected" ? (
    <Badge variant="success">Connected</Badge>
  ) : (
    <Badge variant="secondary">URL only</Badge>
  );
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
  const integrations = listIntegrations(user?.id ?? "demo_user");

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

  return (
    <AppShell demoMode={DEMO_MODE} userEmail={user?.email}>
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your SEM readiness at a glance — scores, issues, and connected data.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/audit/new">
              <PlusCircle /> Run New Audit
            </Link>
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Avg SEM Readiness
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
                  Critical Issues
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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-brand-greenDark">
                <Building2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link href="/audit/new" className="group">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-brand-greenDark">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <CardTitle className="flex items-center justify-between">
                  Run New Audit
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardTitle>
                <CardDescription>
                  Score a website&apos;s paid search readiness in minutes.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/integrations" className="group">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <PlugZap className="h-5 w-5" />
                </div>
                <CardTitle className="flex items-center justify-between">
                  Connect Google
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardTitle>
                <CardDescription>
                  Link Google Ads, GA4, Search Console &amp; Tag Manager.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/reports/demo" className="group">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <CardTitle className="flex items-center justify-between">
                  View Demo Report
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardTitle>
                <CardDescription>
                  Explore a full sample audit with recommendations.
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
              Your latest SEM readiness reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {audits.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-brand-greenDark">
                  <FileSearch className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-semibold">No audits yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Run your first audit to see where your paid search is
                    leaking budget.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild>
                    <Link href="/audit/new">
                      <PlusCircle /> Run your first audit
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/reports/demo">Or view the demo report</Link>
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
