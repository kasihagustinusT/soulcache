interface FrameworkBadgeProps {
  name: string;
  status?: 'supported' | 'experimental';
}

export function FrameworkBadge({ name, status = 'supported' }: FrameworkBadgeProps) {
  const color =
    status === 'supported'
      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/60'
      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60';

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}
    >
      {name}
    </span>
  );
}
