import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/common/Button';
import type { Course } from '@/lib/domain';
import { createSlug } from '@/lib/utils';

export const CourseFormSchema = z.object({
  title: z.string().trim().min(1, 'Course title is required').max(200),
  slug: z.string().trim().min(1, 'Slug is required').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens'),
  description: z.string().max(20000),
  isPremium: z.boolean(),
  price: z.string().optional(),
  currency: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'published']),
  publishAt: z.string().optional(),
}).superRefine((values, context) => {
  if (values.isPremium) {
    if (!values.price || !/^\d{1,10}(\.\d{1,2})?$/.test(values.price) || Number(values.price) <= 0) context.addIssue({ code: 'custom', path: ['price'], message: 'Enter a price greater than zero.' });
    if (!values.currency || !/^[A-Za-z]{3}$/.test(values.currency)) context.addIssue({ code: 'custom', path: ['currency'], message: 'Enter a 3-letter currency code.' });
  }
  if (values.status === 'scheduled' && (!values.publishAt || Number.isNaN(new Date(values.publishAt).getTime()))) context.addIssue({ code: 'custom', path: ['publishAt'], message: 'Choose a publish date and time.' });
});

export type CourseFormValues = z.infer<typeof CourseFormSchema>;

function localDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function CourseForm({ course, onSave, onCancel, saving = false, submitLabel = 'Save course' }: {
  course?: Course;
  onSave: (values: CourseFormValues) => void;
  onCancel?: () => void;
  saving?: boolean;
  submitLabel?: string;
}) {
  const [slugEdited, setSlugEdited] = useState(Boolean(course));
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(CourseFormSchema),
    defaultValues: {
      title: course?.title ?? '', slug: course?.slug ?? '', description: course?.description ?? '',
      isPremium: course?.isPremium ?? false, price: course?.price ?? '', currency: course?.currency ?? 'USD',
      status: course?.status ?? 'draft', publishAt: localDateTime(course?.publishAt ?? null),
    },
  });
  const isPremium = form.watch('isPremium');
  const status = form.watch('status');

  useEffect(() => {
    if (!course) return;
    form.reset({ title: course.title, slug: course.slug, description: course.description ?? '', isPremium: course.isPremium, price: course.price ?? '', currency: course.currency ?? 'USD', status: course.status, publishAt: localDateTime(course.publishAt) });
    setSlugEdited(true);
  }, [course, form]);

  function updateTitle(value: string) {
    form.setValue('title', value, { shouldValidate: true });
    if (!slugEdited) form.setValue('slug', createSlug(value), { shouldValidate: true });
  }

  function submit(values: CourseFormValues) {
    onSave({ ...values, currency: values.isPremium ? values.currency?.toUpperCase() : undefined, price: values.isPremium ? values.price : undefined, publishAt: values.status === 'scheduled' && values.publishAt ? new Date(values.publishAt).toISOString() : undefined });
  }

  return <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
    <div><label className="field-label" htmlFor="course-title">Course title</label><input id="course-title" className="field" placeholder="e.g. Japanese for Beginners" {...form.register('title', { onChange: (event) => updateTitle(event.target.value) })} />{form.formState.errors.title && <FieldError>{form.formState.errors.title.message}</FieldError>}</div>
    <div><label className="field-label" htmlFor="course-slug">URL slug</label><div className="flex items-center rounded-lg border border-line bg-white px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 dark:border-slate-700 dark:bg-slate-950"><span className="text-xs text-slate-400">/courses/</span><input id="course-slug" className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm outline-none" {...form.register('slug', { onChange: () => setSlugEdited(true) })} /></div>{form.formState.errors.slug && <FieldError>{form.formState.errors.slug.message}</FieldError>}</div>
    <div><label className="field-label" htmlFor="course-description">Description</label><textarea id="course-description" rows={3} className="field h-auto min-h-24 py-2.5" placeholder="What will learners study?" {...form.register('description')} />{form.formState.errors.description && <FieldError>{form.formState.errors.description.message}</FieldError>}</div>
    <div className="rounded-xl border border-line p-4 dark:border-slate-700"><label className="flex cursor-pointer items-center justify-between gap-3"><span><span className="block text-sm font-medium text-ink dark:text-white">Premium course</span><span className="mt-1 block text-xs text-muted">Set a price to charge learners</span></span><input type="checkbox" aria-label="Premium course" className="size-4 accent-accent" {...form.register('isPremium')} /></label>
      {isPremium && <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="field-label" htmlFor="course-price">Price</label><input id="course-price" type="number" min="0.01" step="0.01" className="field" placeholder="49.00" {...form.register('price')} />{form.formState.errors.price && <FieldError>{form.formState.errors.price.message}</FieldError>}</div><div><label className="field-label" htmlFor="course-currency">Currency</label><input id="course-currency" className="field uppercase" maxLength={3} placeholder="USD" {...form.register('currency')} />{form.formState.errors.currency && <FieldError>{form.formState.errors.currency.message}</FieldError>}</div></div>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2"><div><label className="field-label" htmlFor="course-status">Status</label><select id="course-status" className="field" {...form.register('status')}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select></div>{status === 'scheduled' && <div><label className="field-label" htmlFor="course-publish-at">Publish date and time</label><input id="course-publish-at" type="datetime-local" className="field" {...form.register('publishAt')} />{form.formState.errors.publishAt && <FieldError>{form.formState.errors.publishAt.message}</FieldError>}</div>}</div>
    <div className="flex justify-end gap-2 border-t border-line pt-4 dark:border-slate-800">{onCancel && <Button type="button" onClick={onCancel}>Cancel</Button>}<Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button></div>
  </form>;
}

function FieldError({ children }: { children?: string }) {
  return children ? <p role="alert" className="mt-1.5 text-xs text-red-600">{children}</p> : null;
}
