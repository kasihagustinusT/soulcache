import { type ReactNode } from 'react';

interface NoteProps {
  type?: 'info' | 'warning' | 'tip' | 'danger' | 'success';
  title?: string;
  children: ReactNode;
}

const styles = {
  info: {
    container: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-l-blue-400',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-800 dark:text-blue-300',
    defaultTitle: 'Note',
  },
  warning: {
    container: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:border-l-amber-400',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-800 dark:text-amber-300',
    defaultTitle: 'Warning',
  },
  tip: {
    container: 'border-l-primary-500 bg-primary-50 dark:bg-primary-950/40 dark:border-l-primary-400',
    icon: 'text-primary-600 dark:text-primary-400',
    title: 'text-primary-800 dark:text-primary-300',
    defaultTitle: 'Tip',
  },
  danger: {
    container: 'border-l-red-500 bg-red-50 dark:bg-red-950/40 dark:border-l-red-400',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-800 dark:text-red-300',
    defaultTitle: 'Danger',
  },
  success: {
    container: 'border-l-green-500 bg-green-50 dark:bg-green-950/40 dark:border-l-green-400',
    icon: 'text-green-600 dark:text-green-400',
    title: 'text-green-800 dark:text-green-300',
    defaultTitle: 'Success',
  },
};

const icons = {
  info: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  tip: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  ),
  danger: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  success: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function Note({ type = 'info', title, children }: NoteProps) {
  const s = styles[type];
  return (
    <div
      className={`my-6 rounded-lg border-l-4 p-4 ${s.container}`}
      role="note"
      aria-label={title ?? s.defaultTitle}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${s.icon}`}>{icons[type]}</span>
        <div className="min-w-0 flex-1">
          <p className={`mb-1 text-sm font-semibold ${s.title}`}>
            {title ?? s.defaultTitle}
          </p>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
