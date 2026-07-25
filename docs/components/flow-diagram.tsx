import { type ReactNode } from 'react';

interface FlowDiagramProps {
  title?: string;
  children: ReactNode;
}

export function FlowDiagram({ title, children }: FlowDiagramProps) {
  return (
    <div className="my-8" role="img" aria-label={title || 'Flow diagram'}>
      {title && (
        <div className="text-[0.6875rem] font-semibold uppercase tracking-wider mb-3 text-muted-foreground">
          {title}
        </div>
      )}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {children}
      </div>
    </div>
  );
}

interface FlowNodeProps {
  children: ReactNode;
  highlight?: boolean;
}

export function FlowNode({ children, highlight }: FlowNodeProps) {
  return (
    <div
      className={`flex-shrink-0 rounded-lg border px-4 py-2.5 text-sm font-medium ${
        highlight
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-card text-foreground'
      }`}
    >
      {children}
    </div>
  );
}

export function FlowArrow() {
  return (
    <span className="flex-shrink-0 text-muted-foreground">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </span>
  );
}
