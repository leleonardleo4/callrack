import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { buildRequestSchemaMap, getRequestSchemaFor } from '../../src/x402/discovery-schema.util.js';
import { WeatherRequestDto } from '../../src/weather/dto/weather-request.dto.js';
import { AcademicSearchRequestDto } from '../../src/academic/dto/academic-search-request.dto.js';
import { GeocodeRequestDto } from '../../src/geocode/dto/geocode-request.dto.js';

describe('discovery-schema.util (E2E — needs a live Nest app for reflection)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('derives a JSON-Schema-shaped object for a DTO, matching its @ApiProperty decorators', () => {
    const schemas = buildRequestSchemaMap(app);
    const schema = getRequestSchemaFor(schemas, WeatherRequestDto);

    expect(schema).toBeDefined();
    expect(schema?.type).toBe('object');
    expect(schema?.properties.latitude).toMatchObject({ type: 'number', minimum: -90, maximum: 90 });
    expect(schema?.properties.longitude).toMatchObject({ type: 'number', minimum: -180, maximum: 180 });
    expect(schema?.required).toEqual(['latitude', 'longitude']);
  });

  it('marks optional DTO fields as not required', () => {
    const schemas = buildRequestSchemaMap(app);
    const schema = getRequestSchemaFor(schemas, AcademicSearchRequestDto);

    expect(schema?.required).toEqual(['query']);
    expect(schema?.properties.limit).toBeDefined();
    expect(schema?.required).not.toContain('limit');
  });

  it('reflects every currently-implemented request DTO, not just a hardcoded subset', () => {
    const schemas = buildRequestSchemaMap(app);
    expect(getRequestSchemaFor(schemas, GeocodeRequestDto)).toBeDefined();
    expect(schemas.size).toBeGreaterThanOrEqual(12);
  });

  it('returns undefined for a class that was never used as a DTO', () => {
    class NotARealDto {}
    const schemas = buildRequestSchemaMap(app);
    expect(getRequestSchemaFor(schemas, NotARealDto)).toBeUndefined();
  });
});
