'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center px-6">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-foreground tracking-tight">500</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Something went wrong
            </p>
            <div className="mt-8 flex items-center justify-center gap-x-4">
              <button
                onClick={() => reset()}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
