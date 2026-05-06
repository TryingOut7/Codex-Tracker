import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders the "No accounts yet" heading', () => {
    render(<EmptyState onAdd={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /no accounts yet/i })).toBeDefined();
  });

  it('renders the terminal mock with the error message', () => {
    render(<EmptyState onAdd={vi.fn()} />);
    expect(screen.getByText(/no accounts configured/i)).toBeDefined();
  });

  it('renders an "Add first account" button', () => {
    render(<EmptyState onAdd={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add first account/i })).toBeDefined();
  });

  it('calls onAdd when the button is clicked', async () => {
    const onAdd = vi.fn();
    render(<EmptyState onAdd={onAdd} />);

    await userEvent.click(screen.getByRole('button', { name: /add first account/i }));

    expect(onAdd).toHaveBeenCalledOnce();
  });
});
