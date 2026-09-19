import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../test-utils/renderRoute';

vi.mock('@/pages/LandingPage', () => ({
  LandingPage: () => {
    throw new Error('boom - simulated render crash');
  },
}));

describe('ErrorPage', () => {
  it('renders a presentable fallback instead of a blank page when a route crashes', async () => {
    renderRoute('/');

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
  });
});
