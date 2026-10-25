import { CircleAlert, UserRoundCog } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

export function UsersPage() {
  return <>
    <PageHeader eyebrow="Administration" title="Users" description="Manage administrator and learner accounts." />
    <section className="surface-card max-w-3xl p-6 md:p-8"><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><CircleAlert className="size-5" /></span><div><h2 className="text-sm font-semibold">User management is not available in the connected API</h2><p className="mt-2 text-sm leading-6 text-muted">The API repository has no `/admin/users` list, role-update, or account-status routes. This page stays read-only until those endpoints are added.</p><p className="mt-4 flex items-center gap-2 text-xs text-muted"><UserRoundCog className="size-4" />Only super admins can see this page.</p></div></div></section>
  </>;
}
