import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Type } from '@nestjs/common';

/** Minimal JSON-Schema-shaped object — what a Bazaar discovery input schema actually needs. */
export interface RequestJsonSchema {
  readonly type: 'object';
  readonly properties: Record<string, unknown>;
  readonly required?: readonly string[];
}

/**
 * Derives each capability's request JSON Schema from the SAME `@ApiProperty`
 * decorators already on its DTO — the identical reflection NestJS's own
 * Swagger module already performs for `/docs/json`. This is why Callrack
 * never hand-writes a second, driftable copy of each request shape for
 * discovery: `SwaggerModule.createDocument` IS the "Zod-schema-to-JSON-Schema"
 * step this project's Zod-free (class-validator) DTOs actually have.
 *
 * Building the document here is a second, independent call from the one
 * bootstrap.ts makes for `/docs/json` — both are pure reflection over static
 * decorators with no side effects, so the results are identical either way.
 */
export function buildRequestSchemaMap(app: NestFastifyApplication): ReadonlyMap<string, RequestJsonSchema> {
  const config = new DocumentBuilder().setTitle('discovery-schema-reflection').setVersion('0').build();
  const document = SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: true });
  const schemas = document.components?.schemas ?? {};

  const map = new Map<string, RequestJsonSchema>();
  for (const [name, schema] of Object.entries(schemas)) {
    if ('properties' in schema) {
      map.set(name, {
        type: 'object',
        properties: (schema.properties ?? {}) as Record<string, unknown>,
        required: schema.required as string[] | undefined,
      });
    }
  }
  return map;
}

/** Looks up a DTO's schema by class — Swagger keys generated schemas by class name. */
export function getRequestSchemaFor(
  schemaMap: ReadonlyMap<string, RequestJsonSchema>,
  dto: Type<object>,
): RequestJsonSchema | undefined {
  return schemaMap.get(dto.name);
}
