"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  connectIntegrationAction,
  disconnectIntegrationAction,
  syncIntegrationAction,
} from "@/app/actions";
import type { IntegrationProvider } from "@/lib/types";

/**
 * Small client wrapper that renders the connect / sync / disconnect controls
 * for a single provider. Server actions are bound with `.bind(null, provider)`
 * and used directly as `<form action={...}>`, so no client handlers are needed
 * — `useFormStatus` gives us a pending state for the spinner.
 */
export function IntegrationActions({
  provider,
  connected,
}: {
  provider: IntegrationProvider;
  connected: boolean;
}) {
  if (!connected) {
    return (
      <form action={connectIntegrationAction.bind(null, provider)} className="w-full">
        <SubmitButton variant="default" className="w-full">
          <Plug className="h-4 w-4" />
          Connect
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="flex w-full items-center gap-2">
      <form action={syncIntegrationAction.bind(null, provider)} className="flex-1">
        <SubmitButton variant="outline" className="w-full">
          <SyncIcon />
          Sync now
        </SubmitButton>
      </form>
      <form action={disconnectIntegrationAction.bind(null, provider)}>
        <SubmitButton variant="ghost" className="text-muted-foreground hover:text-destructive">
          <Unplug className="h-4 w-4" />
          Disconnect
        </SubmitButton>
      </form>
    </div>
  );
}

function SubmitButton({
  children,
  variant,
  className,
}: {
  children: React.ReactNode;
  variant: "default" | "outline" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending} className={className}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  );
}

function SyncIcon() {
  return <RefreshCw className="h-4 w-4" />;
}
