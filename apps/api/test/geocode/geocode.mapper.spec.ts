import { describe, expect, it } from 'vitest';
import { toGeocodeResponse } from '../../src/geocode/geocode.mapper.js';
import type { GeoLocation } from '../../src/providers/geocode/geocode.types.js';

const FULL_LOCATION: GeoLocation = {
  id: '27565124',
  latitude: 6.4550575,
  longitude: 3.3941795,
  label: 'Lagos, Nigeria',
  name: 'Lagos',
  street: undefined,
  houseNumber: undefined,
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  countryCode: 'NG',
  postcode: '100242',
  type: 'city',
};

describe('geocode.mapper', () => {
  it('maps a fully-populated location to the public contract', () => {
    const result = toGeocodeResponse({ locations: [FULL_LOCATION] });
    expect(result.results[0]).toEqual({
      id: '27565124',
      name: 'Lagos',
      street: null,
      houseNumber: null,
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      countryCode: 'NG',
      postcode: '100242',
      latitude: 6.4550575,
      longitude: 3.3941795,
      type: 'city',
    });
  });

  it('uses null for fields Photon did not supply', () => {
    const minimal: GeoLocation = { latitude: 0, longitude: 0, label: 'x' };
    const result = toGeocodeResponse({ locations: [minimal] });
    expect(result.results[0]).toEqual({
      id: null,
      name: null,
      street: null,
      houseNumber: null,
      city: null,
      state: null,
      country: null,
      countryCode: null,
      postcode: null,
      latitude: 0,
      longitude: 0,
      type: null,
    });
  });

  it('normalizes an empty result set', () => {
    expect(toGeocodeResponse({ locations: [] })).toEqual({ results: [] });
  });

  it('does not leak the internal Phase 3 "label" field', () => {
    const result = toGeocodeResponse({ locations: [FULL_LOCATION] });
    expect(result.results[0]).not.toHaveProperty('label');
  });
});
