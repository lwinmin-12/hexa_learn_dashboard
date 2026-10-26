import { http, HttpResponse } from 'msw';
import { expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
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

it('uploads a QR image without sending its signed URL back or losing explicit clears', async () => {
  const method = { id: 'method', name: 'QR', type: 'qr', accountName: null, accountNo: null, qrImageUrl: 'https://signed.example/old', isActive: true } satisfies Parameters<typeof savePaymentMethod>[1] & { id: string };
  const image = new File(['image'], 'qr.png', { type: 'image/png' });
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: { ...method, qrImageUrl: 'https://signed.example/new' } } as never);
  await savePaymentMethod(method.id, method, image);
  const body = patch.mock.calls[0][1] as FormData;
  expect(body.get('file')).toBe(image);
  expect(body.get('qrImageUrl')).toBeNull();
  expect(body.get('accountName')).toBe('');
  patch.mockRestore();
});

it('does not upload a selected QR image when saving a bank transfer method', async () => {
  const method = { id: 'method', name: 'Bank', type: 'bank_transfer', accountName: null, accountNo: '123', qrImageUrl: null, isActive: true } satisfies Parameters<typeof savePaymentMethod>[1] & { id: string };
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: method } as never);
  await savePaymentMethod(null, method, new File(['image'], 'qr.png', { type: 'image/png' }));
  expect(post.mock.calls[0][1]).toEqual({ type: 'bank_transfer', name: 'Bank', accountName: null, accountNo: '123', qrImageUrl: null, isActive: true });
  post.mockRestore();
});
