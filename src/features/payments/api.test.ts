import { http, HttpResponse } from 'msw';
import { expect, it } from 'vitest';
import { API_URL } from '@/lib/constants';
import { server } from '@/test/server';
import { savePaymentMethod } from './api';

it('updates a payment method with only the fields accepted by the API', async () => {
  const method = { id: 'method', name: 'Bank', type: 'bank_transfer', accountName: 'Hexa', accountNo: '123', qrImageUrl: null, isActive: true } satisfies Parameters<typeof savePaymentMethod>[1] & { id: string };
  server.use(http.patch(`${API_URL}/admin/payment-methods/method`, async ({ request }) => {
    const body = await request.json();
    expect(body).toEqual({ name: 'Bank', type: 'bank_transfer', accountName: 'Hexa', accountNo: '123', qrImageUrl: null, isActive: false });
    return HttpResponse.json({ ...method, isActive: false });
  }));
  await expect(savePaymentMethod(method.id, { ...method, isActive: false })).resolves.toMatchObject({ isActive: false });
});
