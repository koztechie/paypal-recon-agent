'use client';

import { useEffect } from 'react';

// Shown when the agent API can't be reached (or returns an error) while rendering an
// endpoint page. Mirrors the dashboard's error card (app/dashboard/error.tsx) without
// depending on its shell: same palette, same "message + retry" shape.
export default function EndpointError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-dvh items-center justify-center bg-pp-canvas px-6 font-paypal">
      <div className="w-full max-w-lg rounded-lg border border-pp-border bg-white p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-pp-danger/10 text-pp-danger text-2xl" aria-hidden>
          !
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-pp-navy">We couldn&apos;t load this page</h1>
        <p className="mt-2 text-[15px] text-pp-muted">
          The agent API didn&apos;t respond as expected. It may be restarting — the data is safe
          in SQLite and will be back on the next try.
        </p>
        {error.message && (
          <p className="mt-4 break-words rounded-lg bg-pp-canvas px-4 py-3 text-left font-mono text-xs text-pp-muted">
            {error.message}
            {error.digest && <span className="block pt-1">Reference: {error.digest}</span>}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-10 rounded bg-pp-blue px-5 text-sm font-semibold text-white hover:bg-pp-blue-dark"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
