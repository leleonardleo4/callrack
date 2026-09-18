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

export const VERIFY_CAPABILITY: PublicCapability = {
  id: 'information.verify',
  name: 'Verify',
  description: 'Verify a claim against existing Callrack capabilities.',
  category: 'information',
  method: 'POST',
  path: '/v1/verify',
  provider: { kind: 'composite' },
  price: { amount: '0.05', currency: 'USDC' },
  status: 'active',
  requestSchema: { type: 'object', properties: { claim: { type: 'string' } }, required: ['claim'] },
  example: { request: { claim: 'test claim' }, response: { data: {}, meta: { requestId: 'req_1' } } },
  responseSchema: { properties: { data: {}, meta: {} }, required: ['data', 'meta'] },
};

export const EVIDENCE_CAPABILITY: PublicCapability = {
  id: 'information.evidence',
  name: 'Evidence',
  description: 'Return a machine-readable evidence pack for a query.',
  category: 'information',
  method: 'POST',
  path: '/v1/evidence',
  provider: { kind: 'composite' },
  price: { amount: '0.05', currency: 'USDC' },
  status: 'active',
  requestSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  example: { request: { query: 'test' }, response: { data: {}, meta: { requestId: 'req_1' } } },
  responseSchema: { properties: { data: {}, meta: {} }, required: ['data', 'meta'] },
};

export const COMPARE_CAPABILITY: PublicCapability = {
  id: 'information.compare',
  name: 'Compare',
  description: 'Compare information gathered from multiple Callrack capabilities.',
  category: 'information',
  method: 'POST',
  path: '/v1/compare',
  provider: { kind: 'composite' },
  price: { amount: '0.10', currency: 'USDC' },
  status: 'active',
  requestSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  example: { request: { query: 'test' }, response: { data: {}, meta: { requestId: 'req_1' } } },
  responseSchema: { properties: { data: {}, meta: {} }, required: ['data', 'meta'] },
};

export const RESEARCH_CAPABILITY: PublicCapability = {
  id: 'research',
  name: 'Research Composition',
  description: 'Aggregate information from selected Callrack research capabilities.',
  category: 'research',
  method: 'POST',
  path: '/v1/research',
  provider: { kind: 'composite' },
  price: { amount: '0.15', currency: 'USDC' },
  status: 'active',
  requestSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  example: { request: { query: 'test' }, response: { data: {}, meta: { requestId: 'req_1' } } },
  responseSchema: { properties: { data: {}, meta: {} }, required: ['data', 'meta'] },
};

export const TESTNET_CAIP2 = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';
export const TESTNET_USDC_ASSET_ID = '10458941';

export const CAPABILITIES_DATA: PublicCapabilitiesData = {
  capabilities: [
    ACADEMIC_SEARCH_CAPABILITY,
    NEWS_SEARCH_CAPABILITY,
    VERIFY_CAPABILITY,
    EVIDENCE_CAPABILITY,
    COMPARE_CAPABILITY,
    RESEARCH_CAPABILITY,
  ],
  network: {
    name: 'testnet',
    caip2: TESTNET_CAIP2,
    facilitatorUrl: 'https://facilitator.example/v1',
  },
};
