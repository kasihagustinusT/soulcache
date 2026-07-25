import { type ReactNode } from 'react';

interface StepsProps {
  children: ReactNode;
}

interface StepProps {
  title: string;
  children: ReactNode;
}

export function Steps({ children }: StepsProps) {
  return (
    <div className="steps">
      {children}
    </div>
  );
}

export function Step({ title, children }: StepProps) {
  return (
    <div className="step">
      <div className="flex-1 pt-1">
        <h4 className="mb-2 text-[1rem] font-semibold text-foreground">
          {title}
        </h4>
        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
