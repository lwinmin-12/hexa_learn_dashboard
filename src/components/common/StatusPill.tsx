const styles: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ready: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  scheduled: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  pending: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  slip_uploaded: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  draft: 'bg-slate-100 text-slate-700 ring-slate-500/10',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  suspended: 'bg-red-50 text-red-700 ring-red-600/20',
  failed: 'bg-red-50 text-red-700 ring-red-600/20',
  uploading: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  not_uploaded: 'bg-slate-100 text-slate-700 ring-slate-500/10',
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const text = label ?? status.replaceAll('_', ' ');
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ring-1 ring-inset ${styles[status] ?? styles.draft}`}>{text}</span>;
}
