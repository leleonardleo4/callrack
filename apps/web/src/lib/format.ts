import type { CapabilityCategory, CapabilityProviderRef } from '@/types/capability';

const CATEGORY_LABELS: Record<CapabilityCategory, string> = {
  academic: 'Academic',
  news: 'News',
  crypto: 'Crypto',
  finance: 'Finance',
  weather: 'Weather',
  geography: 'Geography',
  calendar: 'Calendar',
  knowledge: 'Knowledge',
  government: 'Government',
  research: 'Research',
};

export function formatCategory(category: CapabilityCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Humanizes a real provider slug (e.g. "academic.openalex" → "OpenAlex"), never a fabricated display name. */
function humanizeProviderSlug(slug: string): string {
  const tail = slug.split('.').at(-1) ?? slug;
  const KNOWN_ACRONYMS: Record<string, string> = {
    gdelt: 'GDELT',
    fx: 'FX',
  };
  if (KNOWN_ACRONYMS[tail]) return KNOWN_ACRONYMS[tail];
  return tail
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatProvider(provider: CapabilityProviderRef): string {
  if (provider.kind === 'composite') {
    return 'Composite (Callrack capabilities)';
  }
  return provider.slugs.map(humanizeProviderSlug).join(' + ');
}

export function formatNetworkLabel(network: 'testnet' | 'mainnet'): string {
  return network === 'mainnet' ? 'Algorand Mainnet' : 'Algorand Testnet';
}
