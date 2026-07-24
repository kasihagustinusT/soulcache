import { type ReactNode } from 'react';

interface ArchitectureDiagramProps {
  title?: string;
  children: ReactNode;
}

export function ArchitectureDiagram({ title, children }: ArchitectureDiagramProps) {
  return (
    <div className="arch-diagram" role="img" aria-label={title || 'Architecture diagram'}>
      {title && (
        <div className="arch-diagram-label mb-3">{title}</div>
      )}
      {children}
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
    <div className={`arch-diagram-box ${accent ? 'accent' : ''} ${highlight ? 'highlight' : ''}`}>
      {children}
    </div>
  );
}

export function ArchConnector() {
  return (
    <span className="arch-diagram-connector">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </span>
  );
}

export function ArchRow({ children }: { children: ReactNode }) {
  return <div className="arch-diagram-row">{children}</div>;
}
