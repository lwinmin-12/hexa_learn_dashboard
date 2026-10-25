import { isRouteErrorResponse, useRouteError, Link } from 'react-router-dom';
import { CircleAlert, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';

export function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? error.statusText : error instanceof Error ? error.message : 'An unexpected error occurred.';
  return <div className="grid min-h-screen place-items-center bg-[#FBFCFC] p-6 dark:bg-slate-950"><div className="max-w-md text-center"><CircleAlert className="mx-auto size-8 text-red-500" /><h1 className="mt-4 text-xl font-semibold">Something went wrong</h1><p className="mt-2 text-sm text-muted">{message}</p><Link to="/"><Button variant="primary" className="mt-5">Return to overview</Button></Link></div></div>;
}

export function ForbiddenPage() {
  return <div className="rounded-2xl border border-line bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900"><LockKeyhole className="mx-auto size-8 text-muted" /><PageHeader title="You don't have access to this page" description="Your admin role does not include this section." /><Link to="/"><Button variant="primary">Back to overview</Button></Link></div>;
}

export function NotFoundPage() {
  return <div className="rounded-2xl border border-line bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-widest text-accent">404</p><PageHeader title="Page not found" description="This link may have moved or no longer exists." /><Link to="/"><Button variant="primary">Back to overview</Button></Link></div>;
}
