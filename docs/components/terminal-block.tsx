import { type ReactNode } from 'react';
import { CopyButton } from './copy-button';

interface TerminalBlockProps {
  children: ReactNode;
  title?: string;
}

export function TerminalBlock({ children, title = 'Terminal' }: TerminalBlockProps) {
  const code = typeof children === 'string' ? children : String(children ?? '');
  return (
    <div className="my-6 rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-foreground/10" />
            <span className="h-3 w-3 rounded-full bg-foreground/20" />
            <span className="h-3 w-3 rounded-full bg-foreground/30" />
          </div>
          <span className="ml-2 text-xs font-medium text-muted-foreground font-mono">{title}</span>
        </div>
        <CopyButton text={code} />
      </div>
      <div className="overflow-x-auto px-5 py-4">
        <pre className="m-0 bg-transparent p-0 text-sm leading-relaxed font-mono text-foreground/90">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}
