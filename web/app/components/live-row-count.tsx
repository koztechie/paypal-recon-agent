'use client';

// Live row count for the landing proof chip (stage 113): the page stays STATIC
// (Lighthouse criterion, stage 109) and upgrades the chip client-side right after
// hydration — the number can never drift from the ledger.
import { useEffect, useState } from 'react';

export function LiveRowCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/rows-count', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { count?: number } | null) => {
        if (alive && d && typeof d.count === 'number') setCount(d.count);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return <>{count != null ? `${count} live rows` : 'Live sandbox data'}</>;
}
