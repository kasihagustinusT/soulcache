import { type ReactNode } from 'react';

interface FlowDiagramProps {
  title?: string;
  children: ReactNode;
}

export function FlowDiagram({ title, children }: FlowDiagramProps) {
  return (
    <div className="my-8" role="img" aria-label={title || 'Flow diagram'}>
      {title && (
        <div className="arch-diagram-label mb-3">{title}</div>
      )}
      <div className="flow-diagram">{children}</div>
    </div>
  );
}

interface FlowNodeProps {
  children: ReactNode;
  highlight?: boolean;
}

export function FlowNode({ children, highlight }: FlowNodeProps) {
  return (
    <div className={`flow-node ${highlight ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-950/50' : ''}`}>
      {children}
    </div>
  );
}

export function FlowArrow() {
  return (
    <span className="flow-arrow">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </span>
  );
}
