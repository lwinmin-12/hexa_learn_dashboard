import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

export type Column<T> = { key: string; header: string; className?: string; render: (item: T) => ReactNode };

export function DataTable<T extends { id: string }>({ rows, columns, loading, emptyTitle = 'Nothing here yet', emptyDescription, page, pages, onPageChange }: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  page?: number;
  pages?: number;
  onPageChange?: (page: number) => void;
}) {
  return <div className="overflow-hidden rounded-xl border border-line bg-white dark:border-slate-800 dark:bg-slate-900">
    <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm">
      <thead><tr className="border-b border-line bg-slate-50/70 text-[11px] font-medium uppercase tracking-wider text-muted dark:border-slate-800 dark:bg-slate-950/30">{columns.map((column) => <th key={column.key} className={`whitespace-nowrap px-5 py-3.5 ${column.className ?? ''}`}>{column.header}</th>)}</tr></thead>
      <tbody className="divide-y divide-line dark:divide-slate-800">
        {loading && Array.from({ length: 5 }, (_, row) => <tr key={`skeleton-${row}`}>{columns.map((column) => <td key={column.key} className="px-5 py-4"><div className="h-4 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></td>)}</tr>)}
        {!loading && rows.map((row) => <tr key={row.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">{columns.map((column) => <td key={column.key} className={`px-5 py-4 align-middle ${column.className ?? ''}`}>{column.render(row)}</td>)}</tr>)}
      </tbody>
    </table></div>
    {!loading && rows.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
    {page !== undefined && pages !== undefined && pages > 1 && <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted dark:border-slate-800"><span>Page {page} of {pages}</span><div className="flex gap-2"><Button size="sm" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>Previous</Button><Button size="sm" disabled={page >= pages} onClick={() => onPageChange?.(page + 1)}>Next</Button></div></div>}
  </div>;
}
