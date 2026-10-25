import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionForm } from './QuizBuilderPage';

describe('quiz question validation', () => {
  it('blocks saving a question with no correct answer', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<QuestionForm question={null} saving={false} onCancel={vi.fn()} onSave={onSave} />);

    await user.type(screen.getByLabelText('Question'), 'What does こんにちは mean?');
    await user.type(screen.getByLabelText('Answer option 1'), 'Hello');
    await user.type(screen.getByLabelText('Answer option 2'), 'Goodbye');
    await user.click(screen.getByRole('checkbox', { name: 'Option 1 is correct' }));
    await user.click(screen.getByRole('button', { name: 'Save question' }));

    expect(await screen.findByText('Mark at least one correct answer.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
