import type { ProviderHttpClient } from './provider-http-client.js';
import type { ProviderAdapter, ProviderHealth, ProviderMetadata } from './provider.types.js';

/**
 * Shared base for provider adapters so HTTP/health-check plumbing is written
 * once. Adapters implement `probeHealth` with a cheap, representative call.
 */
export abstract class BaseProviderAdapter implements ProviderAdapter {
  protected constructor(protected readonly http: ProviderHttpClient) {}

  abstract readonly metadata: ProviderMetadata;

  async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.probeHealth();
      return { provider: this.metadata.slug, healthy: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        provider: this.metadata.slug,
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown provider error',
      };
    }
  }

  protected abstract probeHealth(): Promise<unknown>;
}
