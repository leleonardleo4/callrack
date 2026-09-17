import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test-utils/renderRoute';
import { jsonResponse, mockFetchAlways } from '../fixtures/mock-fetch';
import { CAPABILITIES_FIXTURE } from '../fixtures/capabilities';
import { THEME_STORAGE_KEY } from '@/components/ThemeProvider';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeToggle', () => {
  it('defaults to dark when there is no stored preference and the system reports none', () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getAllByRole('button', { name: /switch to light mode/i }).length).toBeGreaterThan(0);
  });

  it('toggles to light mode, removing the dark class and persisting the choice', async () => {
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    const user = userEvent.setup();
    renderRoute('/');

    const toggle = screen.getAllByRole('button', { name: /switch to light mode/i })[0];
    await user.click(toggle);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getAllByRole('button', { name: /switch to dark mode/i }).length).toBeGreaterThan(0);
  });

  it('respects a previously stored light preference on load', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    mockFetchAlways(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_1' } }));
    renderRoute('/');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
