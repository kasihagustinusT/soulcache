import './globals.css';
import { RootProvider } from 'fumadocs-ui/provider';
import type { Metadata } from 'next';
import { BackToTop } from '@/components/back-to-top';

const BASE_URL = 'https://soulcache.vercel.app';
const LOGO_URL = 'https://res.cloudinary.com/vaslp5ww/image/upload/v1784809523/soulcache-logo_isux6t.svg';
const OG_IMAGE_URL = 'https://res.cloudinary.com/vaslp5ww/image/upload/f_auto,q_auto,w_512/v1784806314/soulcache-logo_tjwmu7.png';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    template: '%s | SoulCache',
  },
  description: 'A lightweight, framework-agnostic data fetching and caching runtime for TypeScript applications. Zero runtime dependencies. Full type safety.',
  keywords: ['soulcache', 'data fetching', 'caching', 'react', 'typescript', 'query', 'state management', 'cache', 'hooks'],
  authors: [{ name: 'SoulCache Contributors' }],
  creator: 'SoulCache',
  publisher: 'SoulCache',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'SoulCache',
    title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    description: 'A lightweight, framework-agnostic data fetching and caching runtime for TypeScript applications.',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 512,
        height: 512,
        alt: 'SoulCache',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    description: 'A lightweight, framework-agnostic data fetching and caching runtime for TypeScript applications.',
    images: [OG_IMAGE_URL],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareSourceCode',
              name: 'SoulCache',
              url: BASE_URL,
              description: 'TypeScript Data Fetching & Caching Runtime for Modern Applications',
              license: 'https://opensource.org/licenses/MIT',
              programmingLanguage: 'TypeScript',
              runtimePlatform: 'Node.js',
              codeRepository: 'https://github.com/kasihagustinusT/soulcache',
            }),
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <RootProvider
          search={{
            enabled: true,
          }}
        >
          {children}
          <BackToTop />
        </RootProvider>
      </body>
    </html>
  );
}
