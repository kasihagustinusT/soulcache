interface BadgeProps {
  label: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
}

const variants = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-transparent dark:border-gray-700',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border border-transparent dark:border-primary-800/50',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-transparent dark:border-green-800/50',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-transparent dark:border-amber-800/50',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-transparent dark:border-red-800/50',
};

const sizes = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
};

export function Badge({ label, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]}`}
    >
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
