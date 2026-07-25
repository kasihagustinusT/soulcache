'use client';

import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface AdjacentPage {
  title: string;
  url: string;
  description?: string;
}

interface Props {
  children: ReactNode;
  toc: any;
  slug: string;
  title: string;
  description?: string;
  prev?: AdjacentPage;
  next?: AdjacentPage;
}

export function DocsPageWrapper({ children, toc, slug, title, description, prev, next }: Props) {
  return (
    <DocsPage
      toc={toc}
      footer={{
        component: (
          <div className="flex items-stretch gap-4">
            {prev ? (
              <Link
                href={prev.url}
                className="group flex flex-1 items-start gap-3 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
              >
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">Previous</div>
                  <div className="mt-0.5 text-sm font-semibold text-foreground group-hover:text-foreground">{prev.title}</div>
                </div>
              </Link>
            ) : <div className="flex-1" />}
            {next ? (
              <Link
                href={next.url}
                className="group flex flex-1 items-start justify-end gap-3 rounded-xl bg-muted/50 p-4 text-right transition-colors hover:bg-muted"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">Next</div>
                  <div className="mt-0.5 text-sm font-semibold text-foreground group-hover:text-foreground">{next.title}</div>
                </div>
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ) : <div className="flex-1" />}
          </div>
        ),
      }}
    >
      <DocsTitle>{title}</DocsTitle>
      {description ? <DocsDescription>{description}</DocsDescription> : null}
      <DocsBody>{children}</DocsBody>
    </DocsPage>
  );
}
