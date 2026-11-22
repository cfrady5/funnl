'use client';

import {
  Activity,
  BarChart3,
  CalendarClock,
  Clapperboard,
  Gauge,
  ListChecks,
  Palette,
  PlugZap,
  ScrollText,
  Search,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { cn } from './ui';

const NAV = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/pipeline', label: 'Daily Pipeline', icon: Workflow },
  { href: '/discovery', label: 'Play Discovery', icon: Search },
  { href: '/studio', label: 'Video Studio', icon: Clapperboard },
  { href: '/queue', label: 'Content Queue', icon: ListChecks },
  { href: '/calendar', label: 'Publishing Calendar', icon: CalendarClock },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/brand', label: 'Brand Settings', icon: Palette },
  { href: '/integrations', label: 'Integrations', icon: PlugZap },
  { href: '/logs', label: 'System Logs', icon: ScrollText },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-panel/60">
        <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-8">
          <svg width="34" height="21" viewBox="0 0 100 62" aria-hidden>
            <path d="M4 31 C 22 4, 78 4, 96 31 C 78 58, 22 58, 4 31 Z" fill="none" stroke="#5BE7C4" strokeWidth="8" />
            <circle cx="50" cy="31" r="12" fill="#5BE7C4" />
          </svg>
          <div>
            <div className="text-[13px] font-extrabold tracking-[0.28em]">TIRESIAS</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-faint">Content Engine</div>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? path === '/' : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors',
                  active ? 'bg-panel-2 text-ink' : 'text-muted hover:bg-panel-2/60 hover:text-ink',
                )}
              >
                <Icon className={cn('size-4', active ? 'text-accent' : 'text-faint')} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 border-t border-line px-5 py-4 font-mono text-[10px] uppercase tracking-wider text-faint">
          <Activity className="size-3" /> Local mode · file store
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-9">{children}</main>
    </div>
  );
}
