import { source } from '@/lib/source';
import { DocsLayoutWrapper } from '@/components/docs-layout-wrapper';
import type { ReactNode } from 'react';

let _cachedTree: any = null;

function getCachedTree() {
  if (!_cachedTree) {
    _cachedTree = source.getPageTree();
  }
  return _cachedTree;
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayoutWrapper tree={getCachedTree()}>
      {children}
    </DocsLayoutWrapper>
  );
}
