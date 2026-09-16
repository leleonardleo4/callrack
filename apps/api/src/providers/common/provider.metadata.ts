import type { ProviderMetadata } from './provider.types.js';

/**
 * Identity helper that keeps metadata declarations self-documenting and
 * gives us a single seam to validate metadata shape in the future.
 */
export function defineProviderMetadata(metadata: ProviderMetadata): ProviderMetadata {
  return metadata;
}

/** Renders the attribution line a capability response should surface, if any. */
export function formatAttribution(metadata: ProviderMetadata): string | undefined {
  if (!metadata.attributionRequired) {
    return undefined;
  }
  return metadata.attributionText ?? `Data provided by ${metadata.name} (${metadata.website})`;
}
