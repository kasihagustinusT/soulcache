import { type ReactNode } from 'react';

interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
}

export function ComparisonTable({ headers, rows }: ComparisonTableProps) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`${
                    j === 0
                      ? 'font-medium text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {cell === 'Yes' ? (
                    <span className="text-green-600 dark:text-green-400 font-semibold">&#10003;</span>
                  ) : cell === 'No' ? (
                    <span className="text-red-500 dark:text-red-400 font-semibold">&#10007;</span>
                  ) : cell === 'Partial' ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">~</span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
