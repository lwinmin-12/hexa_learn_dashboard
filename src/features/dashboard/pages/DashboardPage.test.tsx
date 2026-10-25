import { fireEvent, screen } from '@testing-library/react';
import { format, subDays } from 'date-fns';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DashboardPage } from './DashboardPage';

describe('dashboard revenue range', () => {
  it('keeps the selected range within 366 calendar days', () => {
    renderWithProviders(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardPage /></MemoryRouter>);
    const to = screen.getByLabelText('To date');
    const from = screen.getByLabelText('From date');
    const today = new Date();
    const todayValue = format(today, 'yyyy-MM-dd');
    const tooEarly = format(subDays(today, 400), 'yyyy-MM-dd');

    fireEvent.change(from, { target: { value: tooEarly } });
    fireEvent.change(to, { target: { value: todayValue } });

    expect(from).toHaveValue(format(subDays(today, 365), 'yyyy-MM-dd'));
    expect(to).toHaveValue(todayValue);
  });
});
