import { Injectable, type Type } from '@nestjs/common';
import { getRequestSchemaFor, type RequestJsonSchema } from '../x402/discovery-schema.util.js';

/**
 * Holds the request-DTO-to-JSON-Schema reflection produced by
 * `buildRequestSchemaMap` (see `x402/discovery-schema.util.ts`) so it can be
 * reused by the public `GET /v1/capabilities` endpoint without a second,
 * independent reflection pass. `buildRequestSchemaMap` needs a fully-built
 * `NestFastifyApplication` — unavailable at normal constructor-injection
 * time — so `initialize()` is called once from `bootstrap.ts` right after
 * `NestFactory.create()`, the same "compute post-construction, pre-listen"
 * pattern already used there for Swagger and x402 discovery metadata.
 */
@Injectable()
export class CapabilityRequestSchemaService {
  private schemas: ReadonlyMap<string, RequestJsonSchema> = new Map();

  initialize(schemas: ReadonlyMap<string, RequestJsonSchema>): void {
    this.schemas = schemas;
  }

  getFor(dto: Type<object>): RequestJsonSchema | undefined {
    return getRequestSchemaFor(this.schemas, dto);
  }
}
