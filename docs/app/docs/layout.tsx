import { DocsLayout } from '@/components/docs-page';
import { source } from '@/lib/source';
import type { ReactNode } from 'react';
import Link from 'next/link';

const LOGO_URL = 'https://res.cloudinary.com/vaslp5ww/image/upload/v1784809523/soulcache-logo_isux6t.svg';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{
        title: (
          <div className="flex items-center gap-2">
            <img
              src={LOGO_URL}
              alt="SoulCache Logo"
              className="soulcache-logo h-6 w-6"
              width={24}
              height={24}
              loading="eager"
              decoding="async"
            />
            <span>SoulCache</span>
          </div>
        ),
      }}
      links={[
        {
          text: 'GitHub',
          url: 'https://github.com/kasihagustinusT/soulcache',
        },
      ]}
      sidebar={{
        collapsible: true,
        defaultOpenLevel: 1,
      }}
    >
      {children}
    </DocsLayout>
  );
}
