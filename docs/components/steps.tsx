import { type ReactNode } from 'react';

interface StepsProps {
  children: ReactNode;
}

interface StepProps {
  title: string;
  number?: number;
  children: ReactNode;
}

export function Steps({ children }: StepsProps) {
  return (
    <div className="my-6 space-y-0">
      {children}
    </div>
  );
}

let stepCounter = 0;

export function Step({ title, number, children }: StepProps) {
  const stepNum = number ?? ++stepCounter;
  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 dark:bg-primary-500 text-sm font-bold text-white shadow-sm shadow-primary-600/25 dark:shadow-primary-500/30">
          {stepNum}
        </div>
        <div className="mt-2 h-full w-px bg-gradient-to-b from-primary-200 to-transparent dark:from-primary-800 dark:to-transparent" />
      </div>
      <div className="flex-1 pt-1">
        <h4 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h4>
        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400">
          {children}
        </div>
      </div>
    </div>
  );
}
