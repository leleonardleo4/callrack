import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderConfigService,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type { KnowledgeProvider, KnowledgeSearchInput, KnowledgeSearchResult } from '../knowledge.types.js';
import { mapWikidataSearchResponse } from './wikimedia.mapper.js';
import type { WikidataSearchResponse } from './wikimedia.types.js';

const PROVIDER_SLUG = 'knowledge.wikimedia';
const DEFAULT_LANGUAGE = 'en';

/**
 * Same reasoning and value as GDELT_TIMEOUT_MS/GDELT_RETRY in
 * gdelt.provider.ts: no fallback provider, so it keeps one retry, but
 * ProviderHttpClient's own 10s/2-retries default (~30s worst case) leaves
 * too little headroom before an x402 payment settlement attempt runs into
 * the signed transaction's ~30-40s validity window.
 */
const WIKIMEDIA_TIMEOUT_MS = 6_000;
const WIKIMEDIA_RETRY = { maxAttempts: 1 } as const;

/**
 * Wikidata entity-search adapter. Wikimedia policy requires a descriptive
 * User-Agent identifying the client, so it's sent on every request.
 */
@Injectable()
export class WikimediaProvider extends BaseProviderAdapter implements KnowledgeProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'Wikidata',
    description: 'Structured knowledge base entity search.',
    category: 'knowledge',
    website: 'https://www.wikidata.org',
    attributionRequired: true,
    attributionText: 'Data from Wikidata, available under CC0',
    license: 'CC0',
    commercialUse: 'allowed',
  });

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: config.wikimediaBaseUrl,
        timeoutMs: options?.timeoutMs ?? WIKIMEDIA_TIMEOUT_MS,
        retry: options?.retry ?? WIKIMEDIA_RETRY,
        headers: { 'user-agent': config.wikimediaUserAgent },
      }),
    );
  }

  async search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult> {
    const raw = await this.http.requestJson<WikidataSearchResponse>({
      path: 'w/api.php',
      query: {
        action: 'wbsearchentities',
        search: input.query,
        language: input.language ?? DEFAULT_LANGUAGE,
        format: 'json',
        limit: input.limit ?? 10,
      },
    });
    return mapWikidataSearchResponse(raw);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'w/api.php',
      query: { action: 'wbsearchentities', search: 'health', language: 'en', format: 'json', limit: 1 },
    });
  }
}
