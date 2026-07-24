import { type ReactNode } from 'react';

interface APIBoxProps {
  title?: string;
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantStyles = {
  default: 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900',
  success: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30',
  warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30',
  danger: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30',
  info: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30',
};

export function APIBox({ title, children, variant = 'default' }: APIBoxProps) {
  return (
    <div className={`my-6 overflow-hidden rounded-lg border ${variantStyles[variant]}`}>
      {title && (
        <div className="border-b border-gray-200 dark:border-gray-800/50 px-4 py-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
