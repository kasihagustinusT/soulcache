interface BadgeProps {
  label: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
}

const variants = {
  default: 'bg-muted text-muted-foreground border border-border',
  primary: 'bg-primary/10 text-primary border border-primary/20',
  success: 'bg-muted text-foreground border border-border',
  warning: 'bg-muted text-foreground border border-border',
  danger: 'bg-muted text-foreground border border-border',
};

const sizes = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-[11px]',
};

export function Badge({ label, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${variants[variant]} ${sizes[size]}`}>
      {label}
    </span>
  );
}

export function VersionBadge({ version }: { version: string }) {
  return <Badge label={`v${version}`} variant="primary" />;
}

export function PackageBadge({ name }: { name: string }) {
  return <Badge label={name} variant="default" />;
}
