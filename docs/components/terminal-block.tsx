import { type ReactNode } from 'react';
import { CopyButton } from './copy-button';

interface TerminalBlockProps {
  children: ReactNode;
  title?: string;
}

export function TerminalBlock({ children, title = 'Terminal' }: TerminalBlockProps) {
  const code = typeof children === 'string' ? children : '';
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {title}
          </span>
        </div>
        <CopyButton text={code} />
      </div>
      <div className="bg-gray-950 dark:bg-[#020617] p-4 font-mono text-sm text-gray-100 dark:text-gray-200">
        {children}
      </div>
    </div>
  );
}
