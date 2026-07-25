import { type ReactNode } from 'react';

interface APIBoxProps {
  title?: string;
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantStyles = {
  default: 'border-border bg-muted/30',
  success: 'border-border bg-muted/30',
  warning: 'border-border bg-muted/30',
  danger: 'border-border bg-muted/30',
  info: 'border-border bg-muted/30',
};

export function APIBox({ title, children, variant = 'default' }: APIBoxProps) {
  return (
    <div className={`my-6 overflow-hidden rounded-lg border ${variantStyles[variant]}`}>
      {title && (
        <div className="border-b border-border/50 px-4 py-2">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
