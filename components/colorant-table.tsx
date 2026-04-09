"use client";

interface ColorantTableProps {
  formula: string;
}

export function ColorantTable({ formula }: ColorantTableProps) {
  if (!formula) return null;

  const lines = formula.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // Parse each line into columns by splitting on 2+ spaces or tabs
  const rows = lines.map((line) => line.split(/\s{2,}|\t+/).map((c) => c.trim()));

  // Determine if first row is a header (contains keywords like OZ, COLORANT, BAC)
  const firstRow = rows[0].join(" ").toUpperCase();
  const hasHeader = firstRow.includes("OZ") || firstRow.includes("COLORANT") || firstRow.includes("BAC");

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
      <table className="w-full text-xs font-mono">
        {hasHeader && (
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
              {rows[0].map((cell, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400 font-semibold whitespace-nowrap"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.slice(hasHeader ? 1 : 0).map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0
                ? "bg-white dark:bg-neutral-900"
                : "bg-neutral-50 dark:bg-neutral-800/50"
              }
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-1.5 whitespace-nowrap ${
                    j === 0
                      ? "font-medium text-neutral-800 dark:text-neutral-200"
                      : "text-neutral-600 dark:text-neutral-300 text-center"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
