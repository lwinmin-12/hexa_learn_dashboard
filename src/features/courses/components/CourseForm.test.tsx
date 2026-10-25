import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CourseForm } from './CourseForm';

describe('CourseForm validation', () => {
  it('requires premium pricing details and a scheduled publish date', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CourseForm onSave={onSave} />);

    await user.type(screen.getByLabelText('Course title'), 'Practice Japanese');
    await user.click(screen.getByRole('checkbox', { name: 'Premium course' }));
    await user.clear(screen.getByLabelText('Currency'));
    await user.selectOptions(screen.getByLabelText('Status'), 'scheduled');
    await user.click(screen.getByRole('button', { name: 'Save course' }));

    expect(await screen.findByText('Enter a price greater than zero.')).toBeInTheDocument();
    expect(screen.getByText('Enter a 3-letter currency code.')).toBeInTheDocument();
    expect(screen.getByText('Choose a publish date and time.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Price'), '19.99');
    await user.type(screen.getByLabelText('Currency'), 'USD');
    fireEvent.change(screen.getByLabelText('Publish date and time'), { target: { value: '2026-12-01T10:00' } });
    await user.click(screen.getByRole('button', { name: 'Save course' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  });
});
