import type { PublicCapabilitiesData, PublicCapability } from '@/types/capability';

export const WEATHER_CAPABILITY: PublicCapability = {
  id: 'weather',
  name: 'Weather Forecast',
  description: 'Get current conditions and a multi-day daily forecast for a coordinate via Open-Meteo.',
  category: 'weather',
  method: 'POST',
  path: '/v1/weather',
  provider: { kind: 'provider', slugs: ['weather.openmeteo'] },
  price: { amount: '0.003', currency: 'USDC' },
  status: 'active',
  requestSchema: {
    type: 'object',
    properties: {
      latitude: { type: 'number', description: 'Latitude in decimal degrees.', example: 6.5244, minimum: -90, maximum: 90 },
      longitude: { type: 'number', description: 'Longitude in decimal degrees.', example: 3.3792, minimum: -180, maximum: 180 },
      days: { type: 'number', description: 'Number of forecast days.', example: 3, minimum: 1, maximum: 16, default: 3 },
    },
    required: ['latitude', 'longitude'],
  },
  example: {
    request: { latitude: 6.5244, longitude: 3.3792, days: 3 },
    response: { data: { location: { latitude: 6.5244, longitude: 3.3792 } }, meta: { requestId: 'req_example' } },
  },
  responseSchema: {
    properties: { data: { type: 'object' }, meta: { type: 'object' } },
    required: ['data', 'meta'],
  },
};

export const ACADEMIC_SEARCH_CAPABILITY: PublicCapability = {
  id: 'academic.search',
  name: 'Academic Search',
  description: 'Search scholarly literature via OpenAlex.',
  category: 'academic',
  method: 'POST',
  path: '/v1/academic/search',
  provider: { kind: 'provider', slugs: ['academic.openalex', 'academic.crossref'] },
  price: { amount: '0.01', currency: 'USDC' },
  status: 'active',
  requestSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Free-text search query.', example: 'large language models', minLength: 1, maxLength: 500 },
      limit: { type: 'number', description: 'Maximum number of results.', example: 10, minimum: 1, maximum: 50, default: 10 },
    },
    required: ['query'],
  },
  example: {
    request: { query: 'large language models', limit: 5 },
    response: { data: { results: [] }, meta: { requestId: 'req_example' } },
  },
  responseSchema: {
    properties: { data: { type: 'object' }, meta: { type: 'object' } },
    required: ['data', 'meta'],
  },
};

export const RESEARCH_CAPABILITY: PublicCapability = {
  id: 'research',
  name: 'Research Composition',
  description: 'Aggregate information from selected Callrack research capabilities.',
  category: 'research',
  method: 'POST',
  path: '/v1/research',
  provider: { kind: 'composite' },
  price: { amount: '0.05', currency: 'USDC' },
  status: 'active',
  requestSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Research question.', example: 'renewable energy in Africa' },
      sources: { type: 'array', items: { type: 'string' }, description: 'Which sources to use.', example: ['academic', 'news'] },
    },
    required: ['query'],
  },
  example: {
    request: { query: 'renewable energy in Africa', sources: ['academic', 'news'] },
    response: { data: { query: 'renewable energy in Africa', status: 'complete' }, meta: { requestId: 'req_example' } },
  },
  responseSchema: {
    properties: { data: { type: 'object' }, meta: { type: 'object' } },
    required: ['data', 'meta'],
  },
};

export const CAPABILITIES_FIXTURE: PublicCapabilitiesData = {
  capabilities: [WEATHER_CAPABILITY, ACADEMIC_SEARCH_CAPABILITY, RESEARCH_CAPABILITY],
  network: {
    name: 'testnet',
    caip2: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
    facilitatorUrl: 'https://facilitator.goplausible.xyz',
  },
};
