/**
 * Deliberately small allowlist of US Census datasets this capability
 * supports. Prevents this endpoint from becoming an unrestricted proxy to
 * every dataset the Census API hosts. Extend only when a real Callrack use
 * case needs another dataset.
 */
export const ALLOWED_CENSUS_DATASETS = ['acs/acs1', 'acs/acs5'] as const;

export type AllowedCensusDataset = (typeof ALLOWED_CENSUS_DATASETS)[number];
