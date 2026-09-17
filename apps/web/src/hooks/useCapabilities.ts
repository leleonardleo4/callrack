import { useEffect, useState } from 'react';
import { getCapabilities } from '@/lib/api-client';
import type { PublicCapabilitiesData } from '@/types/capability';

export type UseCapabilitiesState =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: PublicCapabilitiesData }
  | { readonly status: 'error'; readonly message: string };

/**
 * The one place the web app fetches capability metadata — every page that
 * shows capabilities or prices (landing, explorer, detail, playground) goes
 * through this hook rather than re-fetching or caching its own copy.
 */
export function useCapabilities(): UseCapabilitiesState {
  const [state, setState] = useState<UseCapabilitiesState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    getCapabilities().then((result) => {
      if (cancelled) return;
      if (result.kind === 'success') {
        setState({ status: 'success', data: result.data });
      } else if (result.kind === 'network-error') {
        setState({ status: 'error', message: result.message });
      } else if (result.kind === 'api-error') {
        setState({ status: 'error', message: result.error.message });
      } else {
        setState({ status: 'error', message: 'Unexpected payment-required response while loading capabilities.' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
