/**
 * Public Research source identifiers. These name Callrack *capabilities*,
 * never upstream providers (e.g. never "openalex" or "coingecko") — the
 * Research API operates one layer above the provider abstraction.
 */
export const SUPPORTED_RESEARCH_SOURCES = ['academic', 'news', 'knowledge', 'government'] as const;

export type ResearchSourceName = (typeof SUPPORTED_RESEARCH_SOURCES)[number];

/**
 * Default source-selection policy when the caller doesn't specify `sources`:
 * academic + news + knowledge are always useful for broad research.
 * Government/Census is deliberately excluded from the default — it requires
 * structured parameters (dataset/year/variables/geography) that cannot be
 * derived from free text, so it only ever runs when explicitly requested
 * with those parameters supplied.
 */
export const DEFAULT_RESEARCH_SOURCES: ResearchSourceName[] = ['academic', 'news', 'knowledge'];
