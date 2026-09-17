import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { buildRequestSchemaMap, getRequestSchemaFor } from '../../src/x402/discovery-schema.util.js';
import { CAPABILITY_METADATA } from '../../src/capabilities/capability-definitions.js';

/**
 * Prevents silent drift between:
 *   - the Capability Registry's real request schema (the DTO, reflected live
 *     via @nestjs/swagger — the same reflection discovery uses)
 *   - the Capability Registry's declared discovery input example
 * and between:
 *   - the Capability Registry's declared discovery output example
 *   - the Capability Registry's declared discovery output schema
 *
 * There is no runtime response schema to compare the output example against
 * (response types are plain TS interfaces — see capability.types.ts), so the
 * output side is checked for internal example/schema consistency instead.
 */
describe('discovery metadata does not drift from the registry it is derived from', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('every discovery input example only uses fields that actually exist on the request DTO', () => {
    const schemas = buildRequestSchemaMap(app);
    for (const capability of CAPABILITY_METADATA) {
      const requestSchema = getRequestSchemaFor(schemas, capability.requestSchema);
      expect(requestSchema, `no live schema found for ${capability.id}'s requestSchema`).toBeDefined();
      const knownFields = new Set(Object.keys(requestSchema!.properties));

      for (const field of Object.keys(capability.discovery.inputExample)) {
        expect(
          knownFields.has(field),
          `${capability.id}'s discovery input example uses "${field}", which is not a field on ${capability.requestSchema.name}`,
        ).toBe(true);
      }
    }
  });

  it('every discovery input example includes every field the request DTO actually requires', () => {
    const schemas = buildRequestSchemaMap(app);
    for (const capability of CAPABILITY_METADATA) {
      const requestSchema = getRequestSchemaFor(schemas, capability.requestSchema);
      for (const requiredField of requestSchema?.required ?? []) {
        expect(
          requiredField in capability.discovery.inputExample,
          `${capability.id}'s discovery input example is missing required field "${requiredField}"`,
        ).toBe(true);
      }
    }
  });

  it('every discovery output example\'s top-level keys exactly match its declared output schema properties', () => {
    for (const capability of CAPABILITY_METADATA) {
      const exampleKeys = Object.keys(capability.discovery.outputExample).sort();
      const schemaKeys = Object.keys(capability.discovery.outputSchema.properties).sort();
      expect(exampleKeys, `${capability.id}: output example/schema top-level keys diverge`).toEqual(schemaKeys);
    }
  });

  it('every field the output schema marks required is actually present in the output example', () => {
    for (const capability of CAPABILITY_METADATA) {
      for (const requiredField of capability.discovery.outputSchema.required ?? []) {
        expect(
          requiredField in capability.discovery.outputExample,
          `${capability.id}'s output schema requires "${requiredField}", absent from its output example`,
        ).toBe(true);
      }
    }
  });

  it('every capability\'s public response envelope declares both "data" and "meta"', () => {
    for (const capability of CAPABILITY_METADATA) {
      expect(capability.discovery.outputExample, `${capability.id} missing "data"`).toHaveProperty('data');
      expect(capability.discovery.outputExample, `${capability.id} missing "meta"`).toHaveProperty('meta');
    }
  });
});
