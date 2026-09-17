import { describe, expect, it } from 'vitest';
import { buildRequestBody, fieldKindFor, initFormState } from '@/lib/dynamic-form';
import { WEATHER_CAPABILITY, RESEARCH_CAPABILITY } from '../fixtures/capabilities';

describe('fieldKindFor', () => {
  it('classifies string, number, boolean, string-array, and json fields', () => {
    expect(fieldKindFor({ type: 'string' })).toBe('string');
    expect(fieldKindFor({ type: 'number' })).toBe('number');
    expect(fieldKindFor({ type: 'boolean' })).toBe('boolean');
    expect(fieldKindFor({ type: 'array', items: { type: 'string' } })).toBe('string-array');
    expect(fieldKindFor({ type: 'object', properties: {} })).toBe('json');
  });

  it('resolves the non-null branch of a nullable union type', () => {
    expect(fieldKindFor({ type: ['number', 'null'] })).toBe('number');
  });
});

describe('initFormState', () => {
  it('seeds form state from the capability example request', () => {
    const state = initFormState(WEATHER_CAPABILITY.requestSchema, WEATHER_CAPABILITY.example.request);
    expect(state.latitude).toBe(6.5244);
    expect(state.longitude).toBe(3.3792);
    expect(state.days).toBe(3);
  });

  it('joins a string-array example into a comma-separated string', () => {
    const state = initFormState(RESEARCH_CAPABILITY.requestSchema, RESEARCH_CAPABILITY.example.request);
    expect(state.sources).toBe('academic, news');
  });
});

describe('buildRequestBody', () => {
  it('rebuilds a valid request body from form state', () => {
    const result = buildRequestBody(WEATHER_CAPABILITY.requestSchema, { latitude: 6.5244, longitude: 3.3792, days: 3 });
    expect(result).toEqual({ ok: true, body: { latitude: 6.5244, longitude: 3.3792, days: 3 } });
  });

  it('splits a comma-separated string field back into an array', () => {
    const result = buildRequestBody(RESEARCH_CAPABILITY.requestSchema, {
      query: 'renewable energy',
      sources: 'academic, news,  knowledge',
    });
    expect(result).toEqual({
      ok: true,
      body: { query: 'renewable energy', sources: ['academic', 'news', 'knowledge'] },
    });
  });

  it('fails with a field-level error when a required field is empty', () => {
    const result = buildRequestBody(WEATHER_CAPABILITY.requestSchema, { latitude: '', longitude: '', days: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('latitude');
    }
  });

  it('fails when a number field cannot be parsed', () => {
    const result = buildRequestBody(WEATHER_CAPABILITY.requestSchema, { latitude: 'not-a-number', longitude: 3.3792, days: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('latitude');
      expect(result.message).toContain('must be a number');
    }
  });

  it('omits an optional empty field rather than sending it as an empty string', () => {
    const result = buildRequestBody(WEATHER_CAPABILITY.requestSchema, { latitude: 6.5244, longitude: 3.3792, days: '' });
    expect(result).toEqual({ ok: true, body: { latitude: 6.5244, longitude: 3.3792 } });
  });
});
