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
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      )}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>
                  <code className="text-xs font-mono text-primary-600 dark:text-primary-400">{row.name}</code>
                  {row.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </td>
                <td>
                  <code className="text-xs font-mono text-gray-600 dark:text-gray-400">{row.type}</code>
                </td>
                <td>
                  {row.default ? (
                    <code className="text-xs font-mono text-gray-500 dark:text-gray-400">{row.default}</code>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600">-</span>
                  )}
                </td>
                <td>{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
