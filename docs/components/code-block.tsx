import { type ReactNode } from 'react';
import { CopyButton } from './copy-button';

interface CodeBlockProps {
  children: ReactNode;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
}

export function CodeBlock({
  children,
  language,
  title,
  showLineNumbers = false,
  maxHeight = '500px',
}: CodeBlockProps) {
  const code = typeof children === 'string' ? children : '';
  const lines = code.split('\n');
  const displayLang = language?.toUpperCase() || 'CODE';

  return (
    <div className="code-block-wrapper">
      <span className="lang-badge">{displayLang}</span>
      <CopyButton text={code} />
      <div className="flex overflow-auto" style={{ maxHeight }}>
        {showLineNumbers && (
          <div className="line-numbers flex-none border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-4">
            {lines.map((_, i) => (
              <div key={i} className="line-number">{i + 1}</div>
            ))}
          </div>
        )}
        <pre className="flex-1 overflow-x-auto bg-gray-950 p-4 text-[13px] leading-relaxed text-gray-100">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}
