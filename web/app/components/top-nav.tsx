'use client';

// Top navigation shared by the three judge-facing screens (stage 104):
// Dashboard (the Ledger grid) / Agent / Settings. Active tab follows the pathname.
// Rendered by EndpointPage (so every endpoint page gets it) and by /agent + /settings.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/reconciliation', label: 'Dashboard' },
  { href: '/agent', label: 'Agent' },
  { href: '/settings', label: 'Settings' },
];

export function TopNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Main" className="flex items-center gap-1 text-sm">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded px-3 py-1.5 font-semibold ${
              active ? 'bg-pp-navy text-white' : 'text-pp-muted hover:bg-pp-highlight hover:text-pp-navy'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
