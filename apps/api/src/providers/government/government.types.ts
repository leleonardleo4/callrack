import type { ProviderAdapter } from '../common/index.js';

export interface GovernmentDatasetResult {
  dataset: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

export interface GovernmentQueryInput {
  dataset: string;
  year: string;
  variables: string[];
  forGeography: string;
}

export interface GovernmentProvider extends ProviderAdapter {
  query(input: GovernmentQueryInput): Promise<GovernmentDatasetResult>;
}
