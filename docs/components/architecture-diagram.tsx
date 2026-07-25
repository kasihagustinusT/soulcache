import { type ReactNode } from 'react';

interface ArchitectureDiagramProps {
  title?: string;
  children: ReactNode;
}

export function ArchitectureDiagram({ title, children }: ArchitectureDiagramProps) {
  return (
    <div className="my-6" role="img" aria-label={title || 'Architecture diagram'}>
      {title && (
        <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      <div className="flex flex-col items-center gap-3">
        {children}
      </div>
    </div>
  );
}

interface ArchBoxProps {
  children: ReactNode;
  accent?: boolean;
  highlight?: boolean;
}

export function ArchBox({ children, accent, highlight }: ArchBoxProps) {
  return (
    <div
      className={`rounded-lg border px-5 py-3 text-sm font-medium text-center ${
        highlight
          ? 'border-primary/40 bg-primary/10 text-primary'
          : accent
            ? 'border-primary/20 bg-primary/5 text-foreground'
            : 'border-border bg-card text-foreground'
      }`}
    >
      {children}
    </div>
  );
}

export function ArchConnector() {
  return (
    <span className="flex items-center justify-center text-muted-foreground">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </span>
  );
}

export function ArchRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-center gap-3 flex-wrap">{children}</div>;
}
