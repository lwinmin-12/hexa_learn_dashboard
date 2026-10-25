import { z } from 'zod';
import { refreshAdminSession } from '@/features/auth/api';
import type { AdminSession } from '@/features/auth/types';

const STORAGE_KEY = 'hexa-admin-session';
const StoredSessionSchema = z.object({ idToken: z.string().min(1), refreshToken: z.string().min(1), expiresAt: z.number().finite().positive() });
let generation = 0;
let pendingRefresh: Promise<string | null> | null = null;

export function readAdminSession() {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return StoredSessionSchema.parse(JSON.parse(saved));
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function storeSession(tokens: Pick<AdminSession, 'idToken' | 'refreshToken' | 'expiresIn'>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ idToken: tokens.idToken, refreshToken: tokens.refreshToken, expiresAt: Date.now() + tokens.expiresIn * 1000 }));
}

export function startAdminSession(tokens: AdminSession) {
  generation++;
  pendingRefresh = null;
  storeSession(tokens);
}

export function clearAdminSession() {
  generation++;
  pendingRefresh = null;
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function getAdminToken(forceRefresh = false): Promise<string | null> {
  const session = readAdminSession();
  if (!session) return null;
  if (!forceRefresh && session.expiresAt > Date.now() + 60000) return session.idToken;
  if (pendingRefresh) return pendingRefresh;
  const currentGeneration = generation;
  const refresh = refreshAdminSession(session.refreshToken).then((tokens) => {
    if (currentGeneration !== generation) return null;
    storeSession(tokens);
    return tokens.idToken;
  }).catch((error: unknown) => {
    if (currentGeneration !== generation) return null;
    clearAdminSession();
    throw error;
  }).finally(() => {
    if (pendingRefresh === refresh) pendingRefresh = null;
  });
  pendingRefresh = refresh;
  return refresh;
}
