import type { PublicCapabilitiesData, PublicCapability } from '../../src/types.js';

export const ACADEMIC_SEARCH_CAPABILITY: PublicCapability = {
  id: 'academic.search',
  name: 'Academic Search',
  description: 'Search scholarly literature and return normalized works.',
  category: 'academic',
  method: 'POST',
  path: '/v1/academic/search',
  provider: { kind: 'provider', slugs: ['academic.openalex', 'academic.crossref'] },
  price: { amount: '0.01', currency: 'USDC' },
  status: 'active',
  requestSchema: {
    type: 'object',
    properties: { query: { type: 'string' }, limit: { type: 'number' } },
    required: ['query'],
  },
  example: { request: { query: 'test' }, response: { data: { results: [] }, meta: { requestId: 'req_1' } } },
  responseSchema: { properties: { data: {}, meta: {} }, required: ['data', 'meta'] },
};

export const NEWS_SEARCH_CAPABILITY: PublicCapability = {
  id: 'news.search',
  name: 'News Search',
  description: 'Search recent news coverage and return normalized articles.',
  category: 'news',
  method: 'POST',
  path: '/v1/news/search',
  provider: { kind: 'provider', slugs: ['news.gdelt'] },
  price: { amount: '0.005', currency: 'USDC' },
  status: 'active',
  requestSchema: {
    type: 'object',
    properties: { query: { type: 'string' }, limit: { type: 'number' } },
    required: ['query'],
  },
  example: { request: { query: 'test' }, response: { data: { results: [] }, meta: { requestId: 'req_1' } } },
  responseSchema: { properties: { data: {}, meta: {} }, required: ['data', 'meta'] },
};

export const TESTNET_CAIP2 = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';
export const TESTNET_USDC_ASSET_ID = '10458941';

export const CAPABILITIES_DATA: PublicCapabilitiesData = {
  capabilities: [ACADEMIC_SEARCH_CAPABILITY, NEWS_SEARCH_CAPABILITY],
  network: {
    name: 'testnet',
    caip2: TESTNET_CAIP2,
    facilitatorUrl: 'https://facilitator.example/v1',
  },
};
