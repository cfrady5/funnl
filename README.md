# srchr — find the leaks in your search funnel

**srchr** is an SEO + Google Ads/PPC + conversion-intelligence platform for local
service businesses, agencies, and small companies. Give it a website URL — and,
when available, connect Google Ads, GA4, Search Console, Google Tag Manager, and
PageSpeed Insights — and it produces a complete, client-ready search-marketing
action plan: SEO foundation, technical SEO, AI-search readiness, keyword
strategy, campaign structure, landing-page conversion quality, conversion
tracking, budget allocation, A/B testing, and a 30/60/90-day roadmap.

It runs **fully in demo mode with zero credentials**, and progressively unlocks
real persistence and live Google data as you add configuration.

> srchr gives best-practice **guidance based on observed signals** — not
> guarantees of rankings or results. It will never recommend keyword stuffing,
> thin scaled pages, or fake "AEO/GEO hacks."

---

## 1. What was built

A production-style Next.js 15 (App Router) SaaS MVP:

- **Landing page** with the srchr story, example insights, and integrations.
- **Auth** (Supabase Auth when configured; a demo user otherwise).
- **Business onboarding** capturing the full business profile.
- **Integrations** dashboard for Google Ads, GA4, Search Console, GTM (OAuth) +
  PageSpeed (API key), with connect/disconnect/sync + account selection.
- **Website crawler** (Cheerio) — crawls up to 30 internal pages, extracts
  metadata, structure, CTAs/forms/phone, images/alt, schema, trust signals,
  canonical/robots, plus site-wide signals (HTTPS, robots.txt, sitemap).
- **Deterministic scoring engine** producing a **Search Funnel Score** and ten
  subscores (SEO foundation, technical SEO, content quality, local visibility,
  AI-search readiness, PPC efficiency, conversion tracking, landing page,
  budget-waste risk, measurement confidence).
- **Recommendation engine** (SEO + PPC rules) ranked by
  *impact × confidence × urgency ÷ difficulty*.
- **Content strategy engine** and **A/B testing engine**.
- **Report page** with 16 client-ready sections, charts, score rings, tables,
  print-to-PDF, and copy/task-list/client-summary actions.
- **Google service wrappers** (Ads via GAQL, GA4 Data API, Search Console, GTM
  read-only) + **PageSpeed Insights**.
- **Supabase schema + RLS** migrations.
- **Demo mode** with the THOY Lawncare dataset.

### Tech stack
Next.js 15 · TypeScript · Tailwind CSS · shadcn-style UI · Supabase (Postgres +
Auth + Storage) · Recharts · Zod · Cheerio · Google OAuth & APIs · optional
Anthropic summary layer.

---

## 2. Run it locally

```bash
# Node 18.18+ (Node 20+ recommended)
npm install
cp .env.example .env.local   # optional — the app runs in demo mode with no env
npm run dev                  # http://localhost:3000
```

Then:

1. Open `http://localhost:3000` and click **View Demo Report** to see a full
   THOY Lawncare audit, or **Run an Audit**.
2. Click **Continue in Demo Mode** on `/login` (no account needed).
3. From the dashboard, **Run New Audit** → enter any public URL → choose
   *URL-only* (works with no credentials) → watch the staged progress → view the
   report.

Useful scripts:

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```

---

## 3. Required API credentials

Everything is optional — the app degrades gracefully. Copy `.env.example` to
`.env.local` and fill in what you have. Each variable is documented inline in
`.env.example`; summary:

| Variable | Needed for | How to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real auth + persistence | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes (bypasses RLS) | Supabase → Settings → API (**server only**) |
| `DATABASE_URL` | Running migrations via a Postgres client | Supabase → Settings → Database |
| `AUTH_SECRET` | Session signing | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth (all four integrations) | Google Cloud Console → Credentials |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API | Google Ads Manager (MCC) → API Center |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Google Ads API | Your MCC customer id (digits only) |
| `ENCRYPTION_KEY` | Encrypting refresh tokens at rest | `openssl rand -base64 32` (32 bytes) |
| `PAGESPEED_API_KEY` | Real Lighthouse scores | Google Cloud → PageSpeed Insights API |
| `AI_API_KEY` | AI executive summary | Anthropic API key (optional) |
| `NEXT_PUBLIC_APP_URL` | Building OAuth redirect URIs | e.g. `http://localhost:3000` |

---

## 4. What works in demo mode (no credentials)

- Landing page, login (demo), onboarding, dashboard, integrations UI.
- **URL-only audits on real websites** — the crawler + SEO/landing/AI-search
  scoring + recommendations + content roadmap + A/B tests all run live.
- The **THOY Lawncare demo report** (`/reports/demo`) — a full SEO + PPC audit
  generated by the real engine over realistic Google-shaped sample data.
- Integration cards can be "connected" in a simulated way to explore the flow.
- Audits and businesses persist in an in-process store for the dev session.

## 5. What works with real Google API credentials

- OAuth connect/disconnect for Google Ads, GA4, Search Console, GTM.
- **Connected / Full audits pulling live data**: Ads (campaigns, ad groups,
  keywords, search terms, quality score), GA4 (landing-page + source/medium +
  events/conversions), Search Console (queries/pages/CTR/position), GTM
  (read-only tag/trigger/variable inspection), and PageSpeed (Lighthouse).
- Durable multi-user persistence + RLS via Supabase.

See `src/lib/google/*` for the service wrappers and example GAQL queries.

---

## 6. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL editor**, run the migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_srchr_expansion.sql`
   (Or, with the Supabase CLI: `supabase db push`.)
3. Copy the URL + anon key + service role key into `.env.local`.
4. RLS is enabled on every table: users can only read their own rows; the
   service role (server-only) writes audit results. Never expose the service
   role key to the browser.

## 7. Google Cloud setup

1. Create a Google Cloud project; enable: **Google Ads API**, **Google
   Analytics Data API**, **Search Console API**, **Tag Manager API**,
   **PageSpeed Insights API**.
2. Configure the OAuth consent screen (External) and add the scopes in
   `src/lib/config.ts` (`adwords`, `analytics.readonly`, `webmasters.readonly`,
   `tagmanager.readonly`).
3. Create an **OAuth 2.0 Client ID** (Web application). Authorized redirect URI:
   `http://localhost:3000/api/oauth/google/callback` (and your production URL).
4. For Google Ads: apply for a **developer token** in your Manager (MCC)
   account's API Center, and set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the MCC id.

---

## 8. Security notes

- Access/refresh tokens are **never** sent to the client; all Google API calls
  are server-side.
- Refresh tokens are **AES-256-GCM encrypted** before storage (`src/lib/crypto.ts`).
  In production, source `ENCRYPTION_KEY` from a secrets manager and rotate it.
- All user-supplied URLs are validated and normalized; the crawler only follows
  internal links on the same host (no open crawling / SSRF amplification) and
  refuses localhost/private-IP targets.
- Dashboard routes are protected by `middleware.ts`; Supabase RLS enforces
  per-user data isolation.
- GTM is **read-only** — srchr inspects and recommends; it never mutates or
  publishes containers (nor Ads/Search Console) in this version.
- Rate-limiting is marked with `TODO(production)` at the crawl + API layers.

---

## 9. Known limitations

- **In-memory store in demo mode**: without Supabase, audits/businesses live in
  a process-global map (fine for `next dev`; not durable across serverless
  instances). With Supabase configured, the full report JSON persists to the
  `audits` table.
- **Background audit processing** is fire-and-forget within the request process.
  For serverless production, move it to a durable queue/worker (Inngest, QStash,
  or a Supabase Edge Function) — noted inline.
- The normalized snapshot tables (`*_snapshots`, `recommendations`,
  `content_opportunities`) are defined and ready; the MVP stores the full report
  JSON as the source of truth and leaves snapshot backfill to a future worker.
- Crawler uses Cheerio (no JS execution). For JS-heavy sites, swap in Playwright
  (the crawler interface is isolated in `src/lib/crawler`).
- PDF export uses the browser's print-to-PDF; a branded server-side PDF is a
  `TODO(production)`.

---

## 10. Suggested next steps

1. Backfill the normalized snapshot tables from the report JSON via a worker.
2. Move audits to a durable job queue with real-time progress.
3. Add Playwright rendering for JS-heavy sites + true Core Web Vitals.
4. Wire Keyword Planner / third-party volume data into the keyword engine.
5. Add an optional **GTM "apply"** mode (write scopes + explicit confirmation).
6. Branded server-side PDF export + scheduled email reports.
7. Multi-business/agency workspaces and saved audit history trends.

---

## Project structure

```
src/
  app/
    page.tsx                  landing
    login/ onboarding/ dashboard/ settings/ demo/
    integrations/             integration cards + account selection
    audit/new/  audit/[id]/   new audit + live progress
    reports/[id]/             the full report (16 sections)
    api/
      audit/run  audit/[id]   start + poll an audit
      oauth/google/...        OAuth start + callback
    actions.ts                server actions (onboarding, integrations)
  components/
    ui/                       shadcn-style primitives + score ring
    report/  nav/  audit/  integrations/
  lib/
    config.ts  auth.ts  crypto.ts  store.ts  integrations.ts  validation.ts
    crawler/                  crawler + pagespeed
    audit/                    scoring (PPC), seo (SEO), rules, seo-rules,
                              content, abtests, priority, engine
    google/                   oauth, ads, ga4, searchconsole, gtm, providers
    ai/summary.ts             AI/deterministic executive summary
    demo/                     THOY Lawncare dataset + demo report
supabase/migrations/          0001 schema · 0002 RLS · 0003 srchr expansion
```
