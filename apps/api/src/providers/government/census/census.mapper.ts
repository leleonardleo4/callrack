import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { GovernmentDatasetResult } from '../government.types.js';
import type { CensusRawResponse } from './census.types.js';

const PROVIDER_SLUG = 'government.census';

export function mapCensusResponse(raw: CensusRawResponse, dataset: string): GovernmentDatasetResult {
  if (!Array.isArray(raw) || raw.length === 0 || !Array.isArray(raw[0])) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Census response was not a header-first array of rows',
      providerSlug: PROVIDER_SLUG,
    });
  }

  const [columns, ...dataRows] = raw;

  const rows = dataRows.map((row) => {
    if (row.length !== columns.length) {
      throw new ProviderError({
        code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
        message: 'Census data row length does not match the header row',
        providerSlug: PROVIDER_SLUG,
      });
    }
    return Object.fromEntries(columns.map((column, index) => [column, row[index]])) as Record<string, string>;
  });

  return { dataset, columns, rows };
}
