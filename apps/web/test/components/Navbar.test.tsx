import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test-utils/renderRoute';
import { jsonResponse, mockFetchAlways } from '../fixtures/mock-fetch';
import { CAPABILITIES_FIXTURE } from '../fixtures/capabilities';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Navbar', () => {
  it('opens an accessible mobile menu with the same navigation links', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    const user = userEvent.setup();
    renderRoute('/');

    await user.click(screen.getByRole('button', { name: /open menu/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Docs' }).length).toBeGreaterThan(0);
  });

  it('brand link always points back to the homepage', () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/capabilities');

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: /callrack/i })).toHaveAttribute('href', '/');
  });
});
