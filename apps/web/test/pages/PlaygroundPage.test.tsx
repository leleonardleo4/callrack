import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test-utils/renderRoute';
import { jsonResponse } from '../fixtures/mock-fetch';
import { CAPABILITIES_FIXTURE } from '../fixtures/capabilities';

function base64Encode(value: unknown): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlaygroundPage', () => {
  it('defaults to the first capability and renders its request schema fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } })),
    );
    renderRoute('/playground');

    expect(await screen.findByText('POST /v1/weather')).toBeInTheDocument();
    expect(screen.getByLabelText(/^latitude/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^longitude/)).toBeInTheDocument();
  });

  it('lets the user pick a different capability, updating the schema shown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } })),
    );
    const user = userEvent.setup();
    renderRoute('/playground');

    await screen.findByText('POST /v1/weather');
    await user.click(screen.getByRole('combobox', { name: /capability/i }));
    await user.click(await screen.findByRole('option', { name: 'Academic Search' }));

    expect(await screen.findByText('POST /v1/academic/search')).toBeInTheDocument();
    expect(screen.getByLabelText(/^query/)).toBeInTheDocument();
  });

  it('shows the real HTTP 402 payment requirement, never a fake success', async () => {
    const challenge = {
      x402Version: 2,
      resource: { url: 'http://localhost/v1/weather' },
      accepts: [
        {
          scheme: 'exact',
          network: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
          asset: '10458941',
          amount: '3000',
          payTo: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
    };
    const capabilitiesFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }),
    );
    const paymentRequiredHeaders = new Headers();
    paymentRequiredHeaders.set('payment-required', base64Encode(challenge));
    paymentRequiredHeaders.set('x-request-id', 'req_402');
    const capabilityCallFetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 402, headers: paymentRequiredHeaders }));

    vi.stubGlobal('fetch', (...args: Parameters<typeof fetch>) => {
      const [url] = args;
      if (String(url).endsWith('/v1/capabilities')) return capabilitiesFetch();
      return capabilityCallFetch();
    });

    const user = userEvent.setup();
    renderRoute('/playground');

    await screen.findByText('POST /v1/weather');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    const response = screen.getByRole('region', { name: /response/i });
    expect(await within(response).findAllByText(/payment required/i)).not.toHaveLength(0);
    expect(within(response).getByText('TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ')).toBeInTheDocument();
    expect(within(response).queryByText(/payment successful/i)).not.toBeInTheDocument();
    expect(within(response).queryByText(/payment verified/i)).not.toBeInTheDocument();
  });

  it('shows an API error distinctly from a 402', async () => {
    const capabilitiesFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }),
    );
    const errorFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'Upstream provider unavailable.' }, meta: { requestId: 'req_502' } }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', (...args: Parameters<typeof fetch>) => {
      const [url] = args;
      if (String(url).endsWith('/v1/capabilities')) return capabilitiesFetch();
      return errorFetch();
    });

    const user = userEvent.setup();
    renderRoute('/playground');

    await screen.findByText('POST /v1/weather');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    const response = screen.getByRole('region', { name: /response/i });
    expect(await within(response).findByText('PROVIDER_UNAVAILABLE')).toBeInTheDocument();
    expect(within(response).getByText('502', { exact: false })).toBeInTheDocument();
    expect(within(response).queryByText(/payment required/i)).not.toBeInTheDocument();
  });

  it('rejects submission with a field-level error when a required field is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } })),
    );
    const user = userEvent.setup();
    renderRoute('/playground');

    await screen.findByText('POST /v1/weather');
    const latitudeInput = screen.getByLabelText(/^latitude/);
    await user.clear(latitudeInput);
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText(/latitude is required/i)).toBeInTheDocument();
  });
});
