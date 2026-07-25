interface FrameworkBadgeProps {
  name: string;
  status?: 'supported' | 'experimental';
}

export function FrameworkBadge({ name, status = 'supported' }: FrameworkBadgeProps) {
  const color =
    status === 'supported'
      ? 'bg-muted text-foreground border-border'
      : 'bg-accent text-foreground border-border';

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}
    >
      {name}
    </span>
  );
}
