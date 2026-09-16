import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { KnowledgeEntity, KnowledgeSearchResult } from '../knowledge.types.js';
import type { WikidataSearchEntity, WikidataSearchResponse } from './wikimedia.types.js';

const PROVIDER_SLUG = 'knowledge.wikimedia';

function normalizeUrl(url: string | undefined, id: string): string {
  if (!url) {
    return `https://www.wikidata.org/wiki/${id}`;
  }
  return url.startsWith('//') ? `https:${url}` : url;
}

export function mapWikidataEntity(raw: WikidataSearchEntity): KnowledgeEntity {
  if (!raw || typeof raw.id !== 'string' || typeof raw.label !== 'string') {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Wikidata entity is missing required fields (id, label)',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return {
    id: raw.id,
    label: raw.label,
    description: raw.description,
    url: normalizeUrl(raw.url, raw.id),
    sourceProvider: 'wikimedia',
  };
}

export function mapWikidataSearchResponse(raw: WikidataSearchResponse): KnowledgeSearchResult {
  if (!raw || !Array.isArray(raw.search)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Wikidata search response is missing a "search" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return { entities: raw.search.map(mapWikidataEntity) };
}
