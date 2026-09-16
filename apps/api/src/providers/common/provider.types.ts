export type ProviderCategory =
  | 'academic'
  | 'news'
  | 'crypto'
  | 'fx'
  | 'weather'
  | 'geocode'
  | 'holidays'
  | 'knowledge'
  | 'government';

export interface ProviderMetadata {
  slug: string;
  name: string;
  description: string;
  category: ProviderCategory;
  website: string;
  attributionRequired: boolean;
  attributionText?: string;
  license?: string;
  commercialUse?: 'allowed' | 'restricted' | 'unknown';
}

export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export interface ProviderAdapter {
  readonly metadata: ProviderMetadata;
  checkHealth(): Promise<ProviderHealth>;
}
