import { AppShell } from "@/components/nav/app-shell";
import { NewAuditForm } from "@/components/audit/new-audit-form";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_MODE, capabilities } from "@/lib/config";
import { listBusinesses } from "@/lib/store";

export default async function NewAuditPage() {
  const user = await getCurrentUser();
  const businesses = await listBusinesses(user?.id ?? null);

  const businessOptions = businesses.map((b) => ({
    id: b.id,
    businessName: b.businessName,
    websiteUrl: b.websiteUrl,
  }));

  return (
    <AppShell demoMode={DEMO_MODE} userEmail={user?.email}>
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Start New Audit</h1>
          <p className="mt-1 text-muted-foreground">
            Answer a few quick questions and srchr will score your search funnel —
            no Google login required.
          </p>
        </header>

        <NewAuditForm
          businesses={businessOptions}
          canUseLiveData={capabilities.hasGoogleAds}
        />
      </div>
    </AppShell>
  );
}
