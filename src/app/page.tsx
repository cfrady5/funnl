import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  LayoutGrid,
  LineChart,
  MousePointerClick,
  Quote,
  Search,
  Sparkles,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreRing } from "@/components/ui/score-ring";

const auditDimensions = [
  {
    icon: Gauge,
    title: "Paid Search Efficiency",
    description:
      "See where your Google Ads spend converts — and where impressions and clicks quietly leak budget.",
  },
  {
    icon: MousePointerClick,
    title: "Landing Page Conversion",
    description:
      "Check whether paid clicks hit message-matched pages built to convert, not a generic homepage.",
  },
  {
    icon: Target,
    title: "Conversion Tracking",
    description:
      "Verify GA4 and Tag Manager are capturing calls, form fills, and purchases the right way.",
  },
  {
    icon: Search,
    title: "Keyword Opportunities",
    description:
      "Surface high-intent terms from Search Console that you're not yet bidding on in paid search.",
  },
  {
    icon: CircleDollarSign,
    title: "Budget Waste",
    description:
      "Pinpoint underperforming ad groups, irrelevant queries, and spend that should be reallocated.",
  },
  {
    icon: LayoutGrid,
    title: "Campaign Structure",
    description:
      "Evaluate account architecture, match types, and themes that make scaling predictable.",
  },
];

const howItWorks = [
  {
    step: 1,
    title: "Enter your website URL",
    description:
      "Start with nothing but a domain. We analyze your site, services, and current paid search footprint.",
  },
  {
    step: 2,
    title: "Connect Google (optional)",
    description:
      "Link Google Ads, GA4, Search Console, and Tag Manager for deeper, account-level insight.",
  },
  {
    step: 3,
    title: "Get a prioritized action plan",
    description:
      "Receive a scored, 11-section SEM report with ranked recommendations you can act on today.",
  },
];

const insights = [
  {
    quote:
      "Your “lawn mowing near me” ad group has high impressions but poor CTR — the ad copy is likely weak.",
    accent: "high" as const,
    label: "Paid Search Efficiency",
  },
  {
    quote:
      "Paid clicks are landing on a generic homepage instead of a message-matched page.",
    accent: "critical" as const,
    label: "Landing Page Conversion",
  },
  {
    quote:
      "Your GTM container is missing phone-click and form-submit conversion tracking.",
    accent: "critical" as const,
    label: "Conversion Tracking",
  },
  {
    quote:
      "Search Console shows organic demand for services you aren’t targeting in paid search.",
    accent: "medium" as const,
    label: "Keyword Opportunities",
  },
];

const integrations = [
  { name: "Google Ads", description: "Campaigns, spend & conversions" },
  { name: "GA4", description: "Behavior & conversion events" },
  { name: "Search Console", description: "Organic queries & demand" },
  { name: "Google Tag Manager", description: "Tracking & tag coverage" },
];

const audiences = [
  {
    icon: Building2,
    title: "Local service businesses",
    description:
      "Stop guessing where your ad dollars go. Get a clear plan to win more calls and bookings in your area.",
  },
  {
    icon: Users,
    title: "Marketing agencies",
    description:
      "Audit prospects in minutes, win pitches with data, and show clients exactly what to fix first.",
  },
  {
    icon: Wrench,
    title: "In-house SEM managers",
    description:
      "Pressure-test your own account, catch tracking gaps, and build a roadmap leadership can rally behind.",
  },
];

const trustStats = [
  { value: "6", label: "Scored dimensions" },
  { value: "11", label: "Section report" },
  { value: "4", label: "Google integrations" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="funnl home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#integrations" className="transition-colors hover:text-foreground">
              Integrations
            </a>
            <a href="#who-its-for" className="transition-colors hover:text-foreground">
              Who it&apos;s for
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/reports/demo">View Demo Report</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/audit/new">Run SEM Audit</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="gradient-navy relative overflow-hidden text-white">
          <div className="container grid items-center gap-12 py-20 md:py-28 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                <Sparkles className="size-3.5 text-brand-greenLight" />
                SEM audit + optimization engine
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Turn any website into a{" "}
                <span className="text-gradient-brand">paid search action plan.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/70">
                Connect your website, Google Ads, GA4, Search Console, and Tag
                Manager to uncover wasted spend, weak landing pages, broken
                tracking, and missed keyword opportunities.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/audit/new">
                    Run SEM Audit
                    <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/reports/demo">View Demo Report</Link>
                </Button>
              </div>
              <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
                {trustStats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-3xl font-bold tabular-nums text-white">
                      {stat.value}
                    </dt>
                    <dd className="mt-1 text-xs font-medium uppercase tracking-wide text-white/50">
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Stylized dashboard preview */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-brand-green/10 blur-2xl" aria-hidden="true" />
              <Card className="relative border-white/10 bg-white/[0.04] text-white shadow-2xl backdrop-blur">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-white">SEM Audit Score</CardTitle>
                    <CardDescription className="text-white/50">
                      bright-lawn-care.com
                    </CardDescription>
                  </div>
                  <Badge variant="success">Live</Badge>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <ScoreRing score={68} label="Overall" />
                    <div className="flex-1 space-y-3">
                      {[
                        { name: "Paid Efficiency", score: 72 },
                        { name: "Landing Pages", score: 54 },
                        { name: "Tracking", score: 41 },
                      ].map((row) => (
                        <div key={row.name}>
                          <div className="mb-1 flex items-center justify-between text-xs text-white/60">
                            <span>{row.name}</span>
                            <span className="tabular-nums text-white/80">{row.score}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-brand-greenLight"
                              style={{ width: `${row.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-brand-greenLight">
                      <LineChart className="size-3.5" />
                      Top opportunity
                    </div>
                    <p className="mt-1.5 text-sm text-white/80">
                      Reallocate $1,240/mo from broad-match queries to high-intent
                      service keywords.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* What it audits */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">What it audits</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Six dimensions, one clear score
              </h2>
              <p className="mt-4 text-muted-foreground">
                Every audit grades the parts of paid search that actually move
                revenue — then tells you what to fix first.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {auditDimensions.map((dim) => (
                <Card key={dim.title} className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <dim.icon className="size-5" />
                    </div>
                    <CardTitle className="mt-4 text-lg">{dim.title}</CardTitle>
                    <CardDescription>{dim.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">How it works</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                From URL to action plan in three steps
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {howItWorks.map((item) => (
                <Card key={item.step} className="relative overflow-hidden">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-base font-bold text-secondary-foreground">
                      {item.step}
                    </div>
                    <CardTitle className="mt-4 text-lg">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Example insights */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">Example insights</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                The kind of findings you&apos;ll get
              </h2>
              <p className="mt-4 text-muted-foreground">
                Specific, prioritized, and tied to the data — not generic advice.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {insights.map((insight) => (
                <Card
                  key={insight.quote}
                  className="border-l-4 border-l-primary"
                >
                  <CardContent className="pt-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Quote className="size-5 text-primary" />
                      <Badge variant={insight.accent}>{insight.accent}</Badge>
                    </div>
                    <p className="text-base font-medium leading-relaxed text-foreground">
                      {insight.quote}
                    </p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {insight.label}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section id="integrations" className="border-y bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">Integrations</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Connects to the tools you already use
              </h2>
              <p className="mt-4 text-muted-foreground">
                Optional, read-only connections deepen the audit. We also pull
                Core Web Vitals from PageSpeed Insights.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {integrations.map((integration) => (
                <Card key={integration.name} className="text-center">
                  <CardContent className="flex flex-col items-center gap-2 py-6">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BarChart3 className="size-6" />
                    </div>
                    <p className="font-semibold">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {integration.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
                <Gauge className="size-4 text-primary" />
                Plus PageSpeed Insights for performance scoring
              </span>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section id="who-its-for" className="py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">Who it&apos;s for</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Built for everyone running paid search
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {audiences.map((audience) => (
                <Card key={audience.title} className="h-full">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                      <audience.icon className="size-5" />
                    </div>
                    <CardTitle className="mt-4 text-lg">{audience.title}</CardTitle>
                    <CardDescription>{audience.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container">
            <div className="gradient-navy relative overflow-hidden rounded-3xl px-6 py-16 text-center text-white sm:px-12">
              <div className="mx-auto max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Run your first SEM audit in minutes
                </h2>
                <p className="mt-4 text-lg text-white/70">
                  No credentials required — try the demo report and see exactly
                  what your audit will look like.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link href="/audit/new">
                      Run SEM Audit
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link href="/reports/demo">View Demo Report</Link>
                  </Button>
                </div>
                <p className="mt-6 inline-flex items-center gap-2 text-sm text-white/50">
                  <CheckCircle2 className="size-4 text-brand-greenLight" />
                  No credentials required — try the demo report.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container flex flex-col items-center justify-between gap-6 py-10 md:flex-row">
          <Logo />
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#integrations" className="transition-colors hover:text-foreground">
              Integrations
            </a>
            <Link href="/reports/demo" className="transition-colors hover:text-foreground">
              Demo report
            </Link>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} funnl. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
