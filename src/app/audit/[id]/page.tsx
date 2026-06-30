import { AppShell } from "@/components/nav/app-shell";
import { AuditProgress } from "@/components/audit/audit-progress";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { getAudit } from "@/lib/store";

export default async function AuditRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const report = await getAudit(id);

  return (
    <AppShell demoMode={DEMO_MODE} userEmail={user?.email}>
      <div className="flex min-h-[60vh] items-center justify-center py-8">
        <AuditProgress id={id} websiteUrl={report?.websiteUrl} />
      </div>
    </AppShell>
  );
}
