import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../test-utils/renderRoute';
import { jsonResponse, mockFetchAlways } from '../fixtures/mock-fetch';
import { CAPABILITIES_FIXTURE } from '../fixtures/capabilities';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DocsPage', () => {
  it('renders the getting-started flow and every documented section', () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/docs');

    expect(screen.getByRole('heading', { level: 1, name: 'Documentation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Getting started' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Authentication & payment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Errors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Networks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agent developer experience' })).toBeInTheDocument();
  });

  it('lists real capabilities with live prices in the API reference table', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/docs');

    expect(await screen.findByText('Weather Forecast')).toBeInTheDocument();
    expect(screen.getByText(/\$0\.003/)).toBeInTheDocument();
  });

  it('never documents a client SDK that does not exist', () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/docs');

    expect(screen.getByText(/there is no published callrack client library yet/i)).toBeInTheDocument();
  });
});
