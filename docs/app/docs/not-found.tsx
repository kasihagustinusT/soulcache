import Link from 'next/link';

export default function DocsNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white">404</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Documentation page not found
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-8 flex items-center justify-center gap-x-4">
          <Link
            href="/docs/installation"
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500"
          >
            Get Started
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
