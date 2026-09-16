import { Injectable } from '@nestjs/common';
import type { ProviderAdapter } from './common/index.js';

/**
 * Runtime registry of upstream provider adapters, keyed by slug (e.g.
 * "academic.openalex"). This is not a capability registry — it only tracks
 * which provider adapters exist and lets callers resolve them by slug.
 */
@Injectable()
export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderAdapter>();

  register(slug: string, provider: ProviderAdapter): void {
    if (this.providers.has(slug)) {
      throw new Error(`Provider "${slug}" is already registered`);
    }
    this.providers.set(slug, provider);
  }

  resolve<T extends ProviderAdapter = ProviderAdapter>(slug: string): T {
    const provider = this.providers.get(slug);
    if (!provider) {
      throw new Error(`Provider "${slug}" is not registered`);
    }
    return provider as T;
  }

  has(slug: string): boolean {
    return this.providers.has(slug);
  }

  list(): ProviderAdapter[] {
    return [...this.providers.values()];
  }
}
