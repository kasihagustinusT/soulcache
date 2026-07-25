import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-foreground tracking-tight">404</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Page not found
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-8 flex items-center justify-center gap-x-4">
          <Link
            href="/docs/installation"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
          >
            Get Started
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
