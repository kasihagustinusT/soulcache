import { type ReactNode } from 'react';

interface FileTreeProps {
  title?: string;
  children: ReactNode;
}

export function FileTree({ title, children }: FileTreeProps) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border" role="tree" aria-label={title || 'File tree'}>
      {title && (
        <div className="border-b border-border bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground">
          {title}
        </div>
      )}
      <div className="bg-card p-2 font-mono text-sm">
        {children}
      </div>
    </div>
  );
}

interface FileTreeFileProps {
  name: string;
  indent?: number;
  desc?: string;
}

export function FileTreeFile({ name, indent = 0, desc }: FileTreeFileProps) {
  const isFile = name.includes('.');
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1 text-foreground hover:bg-accent/50 transition-colors" role="treeitem">
      <span className="shrink-0 text-muted-foreground/50" style={{ width: indent * 16 }}>{'│  '.repeat(indent)}</span>
      <span className="shrink-0 text-muted-foreground">
        {isFile ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        )}
      </span>
      <span className="text-foreground">{name}</span>
      {desc && <span className="text-xs text-muted-foreground ml-auto">{desc}</span>}
    </div>
  );
}

interface FileTreeDirProps {
  name: string;
  indent?: number;
}

export function FileTreeDir({ name, indent = 0 }: FileTreeDirProps) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1 text-foreground hover:bg-accent/50 transition-colors" role="treeitem" aria-expanded>
      <span className="shrink-0 text-muted-foreground/50" style={{ width: indent * 16 }}>{'│  '.repeat(indent)}</span>
      <span className="shrink-0 text-muted-foreground">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      </span>
      <span className="font-semibold text-foreground">{name}</span>
    </div>
  );
}
