import { z } from 'zod';

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string().nullish().transform((value) => value ?? null),
  displayName: z.string().nullish().transform((name) => name?.trim() || 'Administrator'),
  avatarUrl: z.string().nullish().transform((value) => value ?? null),
  role: z.enum(['super_admin', 'page_admin', 'learner']),
  status: z.enum(['active', 'suspended']),
});

export type AdminUserResponse = z.infer<typeof AdminUserSchema>;

export const AdminSessionSchema = z.object({
  idToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().positive(),
  user: AdminUserSchema,
});
export type AdminSession = z.infer<typeof AdminSessionSchema>;
export type AdminCredentials = { email: string; password: string };
