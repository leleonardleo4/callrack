import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test-utils/renderRoute';
import { jsonResponse, mockFetchAlways } from '../fixtures/mock-fetch';
import { CAPABILITIES_FIXTURE } from '../fixtures/capabilities';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CapabilitiesPage', () => {
  it('renders every capability with its real name, price, and endpoint', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/capabilities');

    expect(await screen.findByText('Weather Forecast')).toBeInTheDocument();
    expect(screen.getByText('Academic Search')).toBeInTheDocument();
    expect(screen.getByText('Research Composition')).toBeInTheDocument();

    expect(screen.getByText('POST /v1/weather')).toBeInTheDocument();
    expect(screen.getByText(/\$0\.003/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.01\b/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.05\b/)).toBeInTheDocument();
  });

  it('filters capabilities by search query', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    const user = userEvent.setup();
    renderRoute('/capabilities');

    await screen.findByText('Weather Forecast');
    await user.type(screen.getByPlaceholderText(/search capabilities/i), 'academic');

    expect(screen.queryByText('Weather Forecast')).not.toBeInTheDocument();
    expect(screen.getByText('Academic Search')).toBeInTheDocument();
  });

  it('links each capability card to its detail page', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/capabilities');

    await screen.findByText('Weather Forecast');
    const link = screen.getByRole('link', { name: /weather forecast/i });
    expect(link).toHaveAttribute('href', '/capabilities/weather');
  });

  it('shows an error state, not a blank screen, when the API request fails', async () => {
    mockFetchAlways(
      new Response(JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'boom' }, meta: { requestId: 'req_e' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderRoute('/capabilities');

    expect(await screen.findByText(/couldn.t reach the callrack api/i)).toBeInTheDocument();
  });
});

describe('CapabilityDetailPage', () => {
  it('shows the request schema, example, and payment notice for a real capability', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/capabilities/weather');

    expect(await screen.findByRole('heading', { name: 'Weather Forecast' })).toBeInTheDocument();
    expect(screen.getByText('POST /v1/weather')).toBeInTheDocument();
    expect(screen.getByText('latitude')).toBeInTheDocument();
    expect(screen.getByText(/this endpoint requires x402 payment/i)).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown capability id', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/capabilities/does-not-exist');

    expect(await screen.findByText(/capability not found/i)).toBeInTheDocument();
  });
});
