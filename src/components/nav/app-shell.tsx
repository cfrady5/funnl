"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlugZap,
  FileSearch,
  Settings,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/audit/new", label: "New Audit", icon: PlusCircle },
  { href: "/integrations", label: "Integrations", icon: PlugZap },
  { href: "/reports/demo", label: "Demo Report", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  demoMode,
  userEmail,
}: {
  children: React.ReactNode;
  demoMode: boolean;
  userEmail?: string;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-brand-blueDark"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          {demoMode && (
            <Badge variant="info" className="mb-3 w-full justify-center">
              <FileSearch className="h-3 w-3" /> Demo Mode
            </Badge>
          )}
          <div className="truncate text-xs text-muted-foreground">{userEmail ?? "demo@srchr.xyz"}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:hidden">
          <Link href="/dashboard">
            <Logo />
          </Link>
          {demoMode && <Badge variant="info">Demo</Badge>}
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
