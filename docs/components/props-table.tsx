import { type ReactNode } from 'react';

interface PropsTableProps {
  title?: string;
  rows: Array<{
    name: string;
    type: string;
    required?: boolean;
    default?: string;
    description: ReactNode;
  }>;
}

export function PropsTable({ title = 'Props', rows }: PropsTableProps) {
  return (
    <div className="my-6">
      {title && (
        <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-semibold text-foreground">Prop</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">Default</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <code className="text-xs font-mono text-primary">{row.name}</code>
                  {row.required && (
                    <span className="ml-1 text-foreground">*</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs font-mono text-muted-foreground">{row.type}</code>
                </td>
                <td className="px-4 py-3">
                  {row.default ? (
                    <code className="text-xs font-mono text-muted-foreground">{row.default}</code>
                  ) : (
                    <span className="text-muted-foreground/50">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
