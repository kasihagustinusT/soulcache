'use client';

import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { LOGO_URL } from '@/lib/constants';

interface Props {
  children: ReactNode;
  tree: any;
}

export function DocsLayoutWrapper({ children, tree }: Props) {
  return (
    <DocsLayout
      tree={tree}
      nav={{
        title: (
          <div className="flex items-center gap-2.5">
            <img
              src={LOGO_URL}
              alt="SoulCache"
              className="soulcache-logo h-7 w-7 dark:brightness-0 dark:invert"
            />
            <span className="text-[0.95rem] font-bold text-foreground">SoulCache</span>
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
