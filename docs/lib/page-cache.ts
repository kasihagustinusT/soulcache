import { source } from './source';

interface PageEntry {
  title: string;
  url: string;
  description?: string;
}

interface PageTreeNode {
  name: string;
  url?: string;
  description?: string;
  children?: PageTreeNode[];
}

let _flatPages: PageEntry[] | null = null;

function getFlatPages(): PageEntry[] {
  if (_flatPages) return _flatPages;

  const tree = source.getPageTree();
  const flat: PageEntry[] = [];

  function walk(node: PageTreeNode) {
    if (node.children) {
      for (const child of node.children) {
        if (child.url && child.name && !child.url.includes('/[')) {
          flat.push({ title: child.name, url: child.url, description: child.description });
        }
        walk(child);
      }
    }
  }
  walk(tree as PageTreeNode);

  _flatPages = flat;
  return flat;
}

export function getAdjacentPages(targetUrl: string): { prev?: PageEntry; next?: PageEntry } {
  const flat = getFlatPages();
  const idx = flat.findIndex((p) => p.url === targetUrl);
  return {
    prev: idx > 0 ? flat[idx - 1] : undefined,
    next: idx < flat.length - 1 ? flat[idx + 1] : undefined,
  };
}

export function resetPageCache() {
  _flatPages = null;
}
