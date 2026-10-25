import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PaymentsPage } from './PaymentsPage';

describe('payment review', () => {
  it('requires a rejection reason and removes an approved payment from the review list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentsPage />);

    await screen.findByText('Aiko Tanaka');
    const reviewButtons = await screen.findAllByRole('button', { name: 'Review' });
    await user.click(reviewButtons[0]);
    await screen.findByRole('heading', { name: 'Payment review' });
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const rejectButton = await screen.findByRole('button', { name: 'Reject payment' });
    expect(rejectButton).toBeDisabled();
    await user.type(screen.getByLabelText('Reason'), 'The transfer amount does not match.');
    expect(rejectButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close payment details' }));
    const remainingReviewButtons = await screen.findAllByRole('button', { name: 'Review' });
    await user.click(remainingReviewButtons[0]);
    await screen.findByRole('heading', { name: 'Payment review' });
    await user.click(screen.getByRole('button', { name: 'Approve payment' }));
    const approveButtons = await screen.findAllByRole('button', { name: 'Approve payment' });
    await user.click(approveButtons[approveButtons.length - 1]);

    await waitFor(() => expect(screen.queryByText('Aiko Tanaka')).not.toBeInTheDocument());
    expect(screen.getByText('Kenji Mori')).toBeInTheDocument();
  });
});
