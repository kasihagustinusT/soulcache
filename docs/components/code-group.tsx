import { type ReactNode } from 'react';

interface CodeGroupProps {
  title?: string;
  children: ReactNode;
}

export function CodeGroup({ title, children }: CodeGroupProps) {
  return (
    <div className="my-6 codeblock">
      {title && (
        <div className="codeblock-header">
          <span className="codeblock-title">{title}</span>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
