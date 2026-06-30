"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, Globe, Layers, Link2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AuditMode, ConversionGoal } from "@/lib/types";

interface BusinessOption {
  id: string;
  businessName: string;
  websiteUrl: string;
}

const GOAL_OPTIONS: { value: ConversionGoal; label: string }[] = [
  { value: "calls", label: "Phone calls" },
  { value: "form_fills", label: "Form fills" },
  { value: "bookings", label: "Bookings" },
  { value: "purchases", label: "Purchases" },
  { value: "demo_requests", label: "Demo requests" },
  { value: "newsletter_signup", label: "Newsletter signups" },
  { value: "other", label: "Other" },
];

type DateRange = "7d" | "30d" | "90d" | "custom";

export function NewAuditForm({
  businesses,
  canUseLiveData,
}: {
  businesses: BusinessOption[];
  canUseLiveData: boolean;
}) {
  const router = useRouter();

  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [businessId, setBusinessId] = React.useState("");
  const [mode, setMode] = React.useState<AuditMode>("url_only");
  const [dateRange, setDateRange] = React.useState<DateRange>("30d");
  const [dateStart, setDateStart] = React.useState("");
  const [dateEnd, setDateEnd] = React.useState("");
  const [primaryGoal, setPrimaryGoal] = React.useState<"" | ConversionGoal>("");
  const [notes, setNotes] = React.useState("");
  const [useDemo, setUseDemo] = React.useState(true);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // When switching to a data-backed mode without live credentials, force demo data.
  const usesConnectedData = mode !== "url_only";
  const forceDemo = usesConnectedData && !canUseLiveData;

  function handleBusinessChange(id: string) {
    setBusinessId(id);
    const biz = businesses.find((b) => b.id === id);
    if (biz?.websiteUrl) setWebsiteUrl(biz.websiteUrl);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!websiteUrl.trim()) {
      setError("Please enter a website URL.");
      return;
    }

    const demo = forceDemo ? true : usesConnectedData ? useDemo : false;

    const payload: Record<string, unknown> = {
      websiteUrl: websiteUrl.trim(),
      mode,
      dateRange,
      demo,
    };
    if (businessId) payload.businessId = businessId;
    if (dateRange === "custom") {
      payload.dateStart = dateStart;
      payload.dateEnd = dateEnd;
    }
    if (primaryGoal) payload.primaryGoal = primaryGoal;
    if (notes.trim()) payload.notes = notes.trim();

    setSubmitting(true);
    try {
      const res = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        let code: string | undefined;
        try {
          const data = (await res.json()) as { error?: string };
          code = data.error;
        } catch {
          /* ignore parse failure */
        }
        setError(
          code === "INVALID_URL"
            ? "Please enter a valid website URL."
            : "Something went wrong starting the audit. Please try again.",
        );
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as { id: string };
      router.push(`/audit/${data.id}`);
    } catch {
      setError("Network error — please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Website URL */}
      <div className="space-y-2">
        <Label htmlFor="websiteUrl">Website URL</Label>
        <div className="relative">
          <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="text"
            inputMode="url"
            required
            placeholder="example.com"
            className="pl-9"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
        </div>
      </div>

      {/* Business selector */}
      {businesses.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="businessId">Business (optional)</Label>
          <Select
            id="businessId"
            value={businessId}
            onChange={(e) => handleBusinessChange(e.target.value)}
          >
            <option value="">Just use the URL above</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.businessName}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Selecting a saved business pre-fills its website and tailors the audit.
          </p>
        </div>
      )}

      {/* Mode */}
      <div className="space-y-2">
        <Label>Audit type</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          <ModeCard
            active={mode === "url_only"}
            onClick={() => setMode("url_only")}
            icon={Link2}
            title="URL-only audit"
            description="Crawl + SEO from the URL alone — no Google data."
          />
          <ModeCard
            active={mode === "connected"}
            onClick={() => setMode("connected")}
            icon={Database}
            title="Connected-data audit"
            description="Pulls connected Google Ads, GA4, Search Console & GTM data."
          />
          <ModeCard
            active={mode === "full"}
            onClick={() => setMode("full")}
            icon={Layers}
            title="Full SEO + PPC audit"
            description="Everything — crawl, SEO, and all connected Google data."
          />
        </div>
      </div>

      {/* Demo data option (connected / full mode) */}
      {usesConnectedData && (
        <div className="rounded-lg border bg-muted/30 p-4">
          {forceDemo ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              No Google credentials configured — connected audits use realistic demo
              data.
            </p>
          ) : (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-input accent-primary"
                checked={useDemo}
                onChange={(e) => setUseDemo(e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground">
                  Use demo data (THOY Lawncare sample)
                </span>
                <span className="block text-muted-foreground">
                  Run the connected audit against a realistic sample account instead
                  of your live data.
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      {/* Date range */}
      <div className="space-y-2">
        <Label htmlFor="dateRange">Date range</Label>
        <Select
          id="dateRange"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="custom">Custom</option>
        </Select>
      </div>

      {dateRange === "custom" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dateStart">Start date</Label>
            <Input
              id="dateStart"
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateEnd">End date</Label>
            <Input
              id="dateEnd"
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Primary goal */}
      <div className="space-y-2">
        <Label htmlFor="primaryGoal">Primary conversion goal (optional)</Label>
        <Select
          id="primaryGoal"
          value={primaryGoal}
          onChange={(e) => setPrimaryGoal(e.target.value as "" | ConversionGoal)}
        >
          <option value="">Not specified</option>
          {GOAL_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Anything the audit should know — target locations, recent changes, priorities…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
        />
      </div>

      {error && (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          role="alert"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting audit…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate Audit
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={cn(
          "h-full transition-colors",
          active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40",
        )}
      >
        <CardContent className="flex gap-3 py-4">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
