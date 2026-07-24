import { type ReactNode } from 'react';
import { CopyButton } from './copy-button';

interface CodeGroupProps {
  title?: string;
  children: ReactNode;
}

export function CodeGroup({ title, children }: CodeGroupProps) {
  return (
    <div className="my-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-2">
        {title && (
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {title}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
