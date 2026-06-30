"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AuditStatus, AuditStep } from "@/lib/types";

interface PollResponse {
  status?: AuditStatus;
  steps?: AuditStep[];
  error?: string | null;
}

const POLL_INTERVAL_MS = 1200;
const MAX_NOT_FOUND = 5;

function errorMessage(code: string | null | undefined): string {
  switch (code) {
    case "CRAWL_FAILED":
      return "We couldn't crawl that website. Check the URL is publicly reachable.";
    case "INVALID_URL":
      return "That URL looks invalid.";
    default:
      return "Something went wrong while running your audit. Please try again.";
  }
}

export function AuditProgress({ id, websiteUrl }: { id: string; websiteUrl?: string }) {
  const router = useRouter();
  const [steps, setSteps] = React.useState<AuditStep[]>([]);
  const [status, setStatus] = React.useState<AuditStatus>("running");
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let notFoundCount = 0;

    async function poll() {
      try {
        const res = await fetch(`/api/audit/${id}`, { cache: "no-store" });

        if (res.status === 404) {
          notFoundCount += 1;
          if (notFoundCount >= MAX_NOT_FOUND) {
            if (!cancelled) {
              setErrorCode("NOT_FOUND");
              setFailed(true);
            }
            return;
          }
          schedule();
          return;
        }

        if (!res.ok) {
          schedule();
          return;
        }

        const data = (await res.json()) as PollResponse;
        if (cancelled) return;

        if (data.steps) setSteps(data.steps);
        if (data.status) setStatus(data.status);

        if (data.status === "completed") {
          router.push(`/reports/${id}`);
          return;
        }
        if (data.status === "failed") {
          setErrorCode(data.error ?? null);
          setFailed(true);
          return;
        }
        schedule();
      } catch {
        // Transient network error — keep trying.
        schedule();
      }
    }

    function schedule() {
      if (cancelled) return;
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, router]);

  if (failed) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader className="items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="size-6" />
          </div>
          <CardTitle className="mt-2">Audit didn&apos;t finish</CardTitle>
          <CardDescription>{errorMessage(errorCode)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/audit/new">Try again</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reports/demo">View demo report instead</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const total = steps.length;
  const finished = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const pct = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <CardTitle>Running your SEM audit</CardTitle>
        <CardDescription>
          {websiteUrl ? (
            <>
              Analyzing <span className="font-medium text-foreground">{websiteUrl}</span>
            </>
          ) : (
            "Analyzing your website and account data"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>

        <ol className="space-y-1">
          {steps.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Preparing…</span>
                </li>
              ))
            : steps.map((step) => <StepRow key={step.key} step={step} />)}
        </ol>
      </CardContent>
    </Card>
  );
}

function StepRow({ step }: { step: AuditStep }) {
  const muted = step.status === "pending" || step.status === "skipped";
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5">
        <StepIcon status={step.status} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              muted ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {step.label}
          </span>
          {step.status === "skipped" && <Badge variant="low">Skipped</Badge>}
        </div>
        {step.detail && (
          <p className="text-xs text-muted-foreground">{step.detail}</p>
        )}
      </div>
    </li>
  );
}

function StepIcon({ status }: { status: AuditStep["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="size-4 animate-spin text-primary" />;
    case "done":
      return <CheckCircle2 className="size-4 text-emerald-600" />;
    case "error":
      return <AlertCircle className="size-4 text-red-600" />;
    case "skipped":
    case "pending":
    default:
      return <Circle className="size-4 text-muted-foreground/50" />;
  }
}
