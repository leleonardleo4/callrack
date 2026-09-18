/**
 * Public Information source identifiers. These name Callrack *capabilities*
 * (never upstream providers, e.g. never "openalex" or "gdelt") - same
 * convention as `research/research-sources.constants.ts`.
 *
 * "government" is deliberately excluded here (unlike research, which can
 * opt into it explicitly): verify/evidence/compare all take a single
 * free-text field (`claim`/`query`) with no structured
 * dataset/year/variables/geography parameters for Census to consult, so
 * there is nothing a free-text request could validly supply it with.
 */
export const INFORMATION_SOURCE_NAMES = ['academic', 'news', 'knowledge'] as const;

export type InformationSourceName = (typeof INFORMATION_SOURCE_NAMES)[number];

/** Default source selection when a request omits `sourceTypes`: consult all three. */
export const DEFAULT_INFORMATION_SOURCES: readonly InformationSourceName[] = ['academic', 'news', 'knowledge'];
