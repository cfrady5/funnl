import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileSearch,
  Gauge,
  Keyboard,
  Link2,
  LineChart,
  MousePointerClick,
  Quote,
  Search,
  ShieldCheck,
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

const auditAreas = [
  {
    icon: Search,
    title: "SEO Foundation",
    description:
      "Titles, metadata, headings, internal linking, and on-page signals that help search engines understand your site.",
  },
  {
    icon: Wrench,
    title: "Technical SEO",
    description:
      "Crawlability, indexation, sitemaps, redirects, and Core Web Vitals that quietly gate your organic visibility.",
  },
  {
    icon: Bot,
    title: "AI Search Readiness",
    description:
      "Whether your content is crawlable, helpful, and structured well enough to surface in AI and generative search.",
  },
  {
    icon: Target,
    title: "Keyword Strategy",
    description:
      "The terms you rank for, the demand you're missing, and how organic and paid keyword coverage line up.",
  },
  {
    icon: Gauge,
    title: "Google Ads / PPC",
    description:
      "Campaign structure, match types, spend efficiency, and the queries quietly draining your budget.",
  },
  {
    icon: MousePointerClick,
    title: "Landing Page Conversion",
    description:
      "Whether your pages are message-matched, fast, and built to turn a click into a call, form, or booking.",
  },
  {
    icon: Target,
    title: "Conversion Tracking",
    description:
      "Verify GA4 and Tag Manager actually capture calls, form fills, and purchases the right way.",
  },
  {
    icon: CircleDollarSign,
    title: "Budget Allocation",
    description:
      "Where to reallocate spend across campaigns and channels for more conversions at lower cost.",
  },
];

const togetherColumns = [
  {
    icon: Search,
    title: "SEO builds durable visibility",
    description:
      "Organic visibility compounds. By helping both people and search engines understand your site, SEO earns traffic that keeps working long after the work is done — no spend required to stay visible.",
  },
  {
    icon: Gauge,
    title: "PPC creates fast visibility",
    description:
      "Paid search puts you at the top today. But it only pays off when tracking is accurate, landing pages are message-matched, and account structure is sound — otherwise you're buying clicks that never convert.",
  },
  {
    icon: ShieldCheck,
    title: "Ethical, people-first, always",
    description:
      "srchr recommends fundamentals, not hacks. No tricks, no keyword stuffing, no guarantees of rankings or results — just clear, honest guidance built for real customers and real businesses.",
  },
];

const insights = [
  {
    quote:
      "Your ads are getting clicks, but the landing page has no visible form above the fold.",
    accent: "critical" as const,
    label: "Landing Page Conversion",
  },
  {
    quote:
      "Your highest-impression organic queries are not represented in paid search.",
    accent: "medium" as const,
    label: "Keyword Strategy",
  },
  {
    quote:
      "Your GTM container is missing phone-click conversion tracking.",
    accent: "critical" as const,
    label: "Conversion Tracking",
  },
  {
    quote:
      "Your campaign is sending service-specific traffic to a generic homepage.",
    accent: "high" as const,
    label: "Google Ads / PPC",
  },
  {
    quote: "Your ad group has too many mixed-intent keywords.",
    accent: "medium" as const,
    label: "Campaign Structure",
  },
  {
    quote:
      "Your page has crawl/index issues blocking organic visibility.",
    accent: "critical" as const,
    label: "Technical SEO",
  },
];

const integrations = [
  { name: "Google Ads", description: "Campaigns, spend & conversions" },
  { name: "GA4", description: "Behavior & conversion events" },
  { name: "Search Console", description: "Organic queries & demand" },
  { name: "Google Tag Manager", description: "Tracking & tag coverage (read-only)" },
  { name: "PageSpeed Insights", description: "Core Web Vitals & performance" },
];

const aiReadiness = [
  {
    icon: FileSearch,
    title: "Crawlable & accessible",
    description:
      "AI assistants and generative search can only cite content they can actually reach. srchr checks that your pages are crawlable, indexable, and free of blocking issues.",
  },
  {
    icon: Sparkles,
    title: "Helpful, first-hand content",
    description:
      "Generative results favor genuinely useful, experience-backed content. We score depth, clarity, and structure — not gimmicks.",
  },
  {
    icon: ShieldCheck,
    title: "No fake AEO/GEO hacks",
    description:
      "We explicitly warn against thin AI-spun pages, keyword stuffing, and “AEO/GEO” shortcuts. They don't last, and they risk your reputation. Strong fundamentals win.",
  },
];

const audiences = [
  {
    icon: Building2,
    title: "Local service businesses",
    description:
      "Stop guessing where your marketing dollars go. Get a clear plan to win more calls, bookings, and customers in your area.",
  },
  {
    icon: Users,
    title: "Agencies",
    description:
      "Audit prospects in minutes, win pitches with real data, and show clients exactly what to fix first across SEO and PPC.",
  },
  {
    icon: Wrench,
    title: "In-house teams",
    description:
      "Pressure-test your own site and account, catch tracking gaps, and build a roadmap leadership can rally behind.",
  },
];

const trustStats = [
  { value: "8", label: "Audited areas" },
  { value: "SEO + PPC", label: "In one report" },
  { value: "No API", label: "Required to start" },
];

const auditWays = [
  {
    icon: Link2,
    title: "URL-only",
    description:
      "Enter a website and get SEO, technical, landing page, and AI-search findings.",
    recommended: false,
  },
  {
    icon: Keyboard,
    title: "Manual analytics",
    description:
      "Paste your GA4/Ads/Search Console numbers for a much stronger report — no API access needed.",
    recommended: true,
  },
  {
    icon: Link2,
    title: "Connected Google data",
    description:
      "Connect Google Ads, GA4, Search Console & GTM for the deepest audit.",
    recommended: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="srchr home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#three-ways" className="transition-colors hover:text-foreground">
              Three ways
            </a>
            <a href="#what-we-audit" className="transition-colors hover:text-foreground">
              What we audit
            </a>
            <a href="#seo-ppc" className="transition-colors hover:text-foreground">
              SEO + PPC
            </a>
            <a href="#integrations" className="transition-colors hover:text-foreground">
              Connected data
            </a>
            <a href="#who-its-for" className="transition-colors hover:text-foreground">
              Who it&apos;s for
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/audit/new">Start Audit</Link>
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
                <Sparkles className="size-3.5 text-brand-blueLight" />
                SEO + PPC + conversion intelligence
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Find what is leaking before you{" "}
                <span className="text-gradient-brand">spend more on marketing.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/70">
                Run a website, SEO, PPC, landing page, and tracking audit using
                your URL, manual analytics data, or connected Google accounts.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/audit/new">
                    Start Audit
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
              <p className="mt-5 inline-flex items-center gap-2 text-sm text-white/60">
                <CheckCircle2 className="size-4 text-brand-blueLight" />
                No Google API access required — start with just your URL.
              </p>
              <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
                {trustStats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                      {stat.value}
                    </dt>
                    <dd className="mt-1 text-xs font-medium uppercase tracking-wide text-white/50">
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Stylized report preview */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-brand-blue/10 blur-2xl" aria-hidden="true" />
              <Card className="relative border-white/10 bg-white/[0.04] text-white shadow-2xl backdrop-blur">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-white">Search Funnel Score</CardTitle>
                    <CardDescription className="text-white/50">
                      bright-lawn-care.com
                    </CardDescription>
                  </div>
                  <Badge variant="success">Live</Badge>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <ScoreRing score={64} label="Search Funnel" />
                    <div className="flex-1 space-y-3">
                      {[
                        { name: "SEO", score: 71 },
                        { name: "PPC", score: 58 },
                        { name: "Tracking", score: 43 },
                      ].map((row) => (
                        <div key={row.name}>
                          <div className="mb-1 flex items-center justify-between text-xs text-white/60">
                            <span>{row.name}</span>
                            <span className="tabular-nums text-white/80">{row.score}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-brand-blueLight"
                              style={{ width: `${row.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-brand-blueLight">
                      <LineChart className="size-3.5" />
                      Top leak
                    </div>
                    <p className="mt-1.5 text-sm text-white/80">
                      Service-specific ad clicks are landing on a generic
                      homepage with no form above the fold.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Three ways to audit */}
        <section id="three-ways" className="border-b py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">Three ways to audit</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                You do not need Google API access to get value
              </h2>
              <p className="mt-4 text-muted-foreground">
                Start with just a URL, add your own numbers for a much stronger
                report, or connect Google for the deepest audit. Pick the level
                that fits you.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {auditWays.map((way) => (
                <Card
                  key={way.title}
                  className={
                    way.recommended
                      ? "relative h-full border-primary shadow-md ring-1 ring-primary/20"
                      : "relative h-full"
                  }
                >
                  {way.recommended ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="success">Most popular</Badge>
                    </div>
                  ) : null}
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <way.icon className="size-5" />
                    </div>
                    <CardTitle className="mt-4 text-lg">{way.title}</CardTitle>
                    <CardDescription>{way.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
              Recommended:{" "}
              <span className="font-medium text-foreground">
                Manual analytics
              </span>{" "}
              gives most teams the strongest report without any API setup.
            </p>
          </div>
        </section>

        {/* What srchr audits */}
        <section id="what-we-audit" className="py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">What srchr audits</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Your entire search funnel, scored
              </h2>
              <p className="mt-4 text-muted-foreground">
                srchr looks across SEO, paid search, and conversion tracking —
                then tells you exactly where traffic leaks and what to fix first.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {auditAreas.map((area) => (
                <Card key={area.title} className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <area.icon className="size-5" />
                    </div>
                    <CardTitle className="mt-4 text-lg">{area.title}</CardTitle>
                    <CardDescription>{area.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* SEO + PPC together */}
        <section id="seo-ppc" className="border-y bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">SEO + PPC together</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                They work best as one system
              </h2>
              <p className="mt-4 text-muted-foreground">
                Organic and paid search aren&apos;t rivals — they reinforce each
                other. srchr scores both, and the conversion tracking that ties
                them together.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {togetherColumns.map((col) => (
                <Card key={col.title} className="h-full">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <col.icon className="size-5" />
                    </div>
                    <CardTitle className="mt-4 text-lg">{col.title}</CardTitle>
                    <CardDescription>{col.description}</CardDescription>
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
                Specific, prioritized, and tied to your data — not generic advice.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

        {/* Connected Google data */}
        <section id="integrations" className="border-y bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">Connected Google data</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Connects to the data you already have
              </h2>
              <p className="mt-4 text-muted-foreground">
                Optional, read-only connections deepen the audit. Tokens stay
                server-side and your Tag Manager access is read-only — srchr
                never changes your account.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                <ShieldCheck className="size-4 text-primary" />
                Tokens stay server-side · GTM access is read-only
              </span>
            </div>
          </div>
        </section>

        {/* AI Search readiness */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">AI Search readiness</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Ready for AI search — the honest way
              </h2>
              <p className="mt-4 text-muted-foreground">
                srchr scores how likely your content is to surface in AI and
                generative search by measuring real fundamentals — not by
                chasing fake &ldquo;AEO/GEO&rdquo; hacks.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {aiReadiness.map((item) => (
                <Card key={item.title} className="h-full">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="size-5" />
                    </div>
                    <CardTitle className="mt-4 text-lg">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
              We explicitly avoid thin AI-generated pages, keyword stuffing, and
              shortcut &ldquo;AEO/GEO&rdquo; tactics. Crawlable, helpful,
              first-hand content is what actually earns visibility.
            </p>
          </div>
        </section>

        {/* Who it's for */}
        <section id="who-its-for" className="border-y bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="secondary">Who it&apos;s for</Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Built for local businesses and agencies
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
                  Find the leaks in your funnel
                </h2>
                <p className="mt-4 text-lg text-white/70">
                  See your website, SEO, Google Ads, and conversion tracking
                  scored in one report — with a prioritized list of what to fix.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link href="/audit/new">
                      Start Audit
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
                <p className="mt-6 inline-flex items-center gap-2 text-sm text-white/50">
                  <CheckCircle2 className="size-4 text-brand-blueLight" />
                  No Google API access required — start with just your URL.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container flex flex-col gap-6 py-10">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" aria-label="srchr home"><Logo /></Link>
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <a href="#what-we-audit" className="transition-colors hover:text-foreground">
                What we audit
              </a>
              <a href="#seo-ppc" className="transition-colors hover:text-foreground">
                SEO + PPC
              </a>
              <a href="#integrations" className="transition-colors hover:text-foreground">
                Connected data
              </a>
              <Link href="/login" className="transition-colors hover:text-foreground">
                Sign in
              </Link>
            </nav>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t pt-6 text-center md:flex-row md:text-left">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} srchr · srchr.xyz · All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Recommendations are guidance, not guarantees of rankings or results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
