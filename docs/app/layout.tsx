import './globals.css';
import { RootProvider } from 'fumadocs-ui/provider';
import type { Metadata } from 'next';
import { SplashScreen } from '@/components/splash-screen';
import { BASE_URL, LOGO_URL, OG_IMAGE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    template: '%s | SoulCache',
  },
  description: 'A high-performance runtime for data fetching and caching. Zero runtime dependencies. Full type safety. Framework-agnostic.',
  keywords: ['soulcache', 'data fetching', 'caching', 'react', 'typescript', 'query', 'state management', 'cache', 'hooks', 'ssr', 'hydration'],
  authors: [{ name: 'SoulCache Contributors' }],
  creator: 'SoulCache',
  publisher: 'SoulCache',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'SoulCache',
    title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    description: 'A high-performance runtime for data fetching and caching.',
    images: [{ url: OG_IMAGE_URL, width: 512, height: 512, alt: 'SoulCache' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    description: 'A high-performance runtime for data fetching and caching.',
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
    icon: [
      { url: LOGO_URL, type: 'image/svg+xml' },
    ],
    shortcut: LOGO_URL,
    apple: LOGO_URL,
  },
  manifest: '/manifest.json',
  alternates: { canonical: BASE_URL },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={LOGO_URL} type="image/svg+xml" />
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
              description: 'A high-performance runtime for data fetching and caching',
              license: 'https://opensource.org/licenses/MIT',
              programmingLanguage: 'TypeScript',
              runtimePlatform: 'Node.js',
              codeRepository: 'https://github.com/kasihagustinusT/soulcache',
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <RootProvider search={{ enabled: false }}>
          {children}
        </RootProvider>
        <SplashScreen />
      </body>
    </html>
  );
}
