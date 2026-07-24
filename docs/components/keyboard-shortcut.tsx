import { type ReactNode } from 'react';

interface KeyboardShortcutProps {
  keys: string[];
  description: string;
}

export function KeyboardShortcut({ keys, description }: KeyboardShortcutProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900/50">
      <span className="text-sm text-gray-700 dark:text-gray-300">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && <span className="mx-1 text-gray-400 dark:text-gray-600">+</span>}
            <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-1.5 font-mono text-[11px] font-medium text-gray-600 dark:text-gray-400">
              {key}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

interface ShortcutListProps {
  shortcuts: KeyboardShortcutProps[];
}

export function ShortcutList({ shortcuts }: ShortcutListProps) {
  return (
    <div className="my-6 space-y-2">
      {shortcuts.map((shortcut) => (
        <KeyboardShortcut key={shortcut.description} {...shortcut} />
      ))}
    </div>
  );
}
