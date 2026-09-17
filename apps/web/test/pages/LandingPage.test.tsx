import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test-utils/renderRoute';
import { jsonResponse, mockFetchAlways } from '../fixtures/mock-fetch';
import { CAPABILITIES_FIXTURE } from '../fixtures/capabilities';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LandingPage', () => {
  it('renders the hero headline and product positioning', () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/');

    expect(screen.getByRole('heading', { level: 1, name: /call information\.\s*pay only when you use it\./i })).toBeInTheDocument();
  });

  it('shows the site navigation with links to Capabilities, Docs, and Playground', () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/');

    const nav = screen.getAllByRole('navigation')[0];
    expect(within(nav).getByRole('link', { name: 'Capabilities' })).toHaveAttribute('href', '/capabilities');
    expect(within(nav).getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
    expect(within(nav).getByRole('link', { name: 'Playground' })).toHaveAttribute('href', '/playground');
  });

  it('renders live capabilities fetched from the API, with real prices', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/');

    expect(await screen.findByText('Weather Forecast')).toBeInTheDocument();
    expect(screen.getAllByText('Academic Search').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$0\.003/).length).toBeGreaterThan(0);
  });

  it('navigates to the capabilities page when "Explore capabilities" is clicked', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    const user = userEvent.setup();
    renderRoute('/');

    await user.click(screen.getAllByRole('link', { name: /explore capabilities/i })[0]);

    expect(await screen.findByRole('heading', { name: /every capability, live from the registry/i })).toBeInTheDocument();
  });

  it('shows an honest error state when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderRoute('/');

    expect(await screen.findByText(/couldn.t reach the callrack api/i)).toBeInTheDocument();
  });
});
