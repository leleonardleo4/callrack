import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Type } from '@nestjs/common';

/** Minimal JSON-Schema-shaped object — what a Bazaar discovery input schema actually needs. */
export interface RequestJsonSchema {
  readonly type: 'object';
  readonly properties: Record<string, unknown>;
  readonly required?: readonly string[];
}

const SCHEMA_REF_PREFIX = '#/components/schemas/';

/**
 * Recursively inlines every `#/components/schemas/X` `$ref` with the
 * resolved schema it points to. NestJS's Swagger generator uses `$ref` for
 * nested DTOs (e.g. `ResearchRequestDto.government` references
 * `ResearchGovernmentOptionsDto`), which is correct in the context of the
 * FULL OpenAPI document — but a Bazaar `inputSchema` is a single,
 * standalone snippet attached to one route, with no `components.schemas`
 * dictionary of its own for a `$ref` to resolve against. Left un-dereferenced,
 * the x402 SDK itself flags this at startup as an invalid bazaar extension.
 * `seen` guards against a schema that (directly or transitively) references
 * itself, which would otherwise recurse forever.
 */
function dereferenceSchema(value: unknown, schemas: Record<string, unknown>, seen: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => dereferenceSchema(item, schemas, seen));
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const obj = value as Record<string, unknown>;
  const ref = obj.$ref;
  if (typeof ref === 'string' && ref.startsWith(SCHEMA_REF_PREFIX)) {
    const name = ref.slice(SCHEMA_REF_PREFIX.length);
    if (seen.has(name) || !(name in schemas)) {
      // Self/circular reference, or a reference to something we don't have
      // — leave the $ref as-is rather than recursing forever or fabricating data.
      return obj;
    }
    return dereferenceSchema(schemas[name], schemas, new Set([...seen, name]));
  }

  const result: Record<string, unknown> = {};
  for (const [key, propertyValue] of Object.entries(obj)) {
    result[key] = dereferenceSchema(propertyValue, schemas, seen);
  }
  return result;
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
 *
 * Every nested-DTO `$ref` is fully inlined (see `dereferenceSchema`) so each
 * resulting schema is self-contained — required for a standalone Bazaar
 * `inputSchema`, which has no `components.schemas` dictionary to resolve
 * `$ref`s against.
 */
export function buildRequestSchemaMap(app: NestFastifyApplication): ReadonlyMap<string, RequestJsonSchema> {
  const config = new DocumentBuilder().setTitle('discovery-schema-reflection').setVersion('0').build();
  const document = SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: true });
  const schemas = (document.components?.schemas ?? {}) as Record<string, unknown>;

  const map = new Map<string, RequestJsonSchema>();
  for (const [name, schema] of Object.entries(schemas)) {
    if (schema && typeof schema === 'object' && 'properties' in schema) {
      const dereferenced = dereferenceSchema(schema, schemas, new Set([name])) as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      map.set(name, {
        type: 'object',
        properties: dereferenced.properties ?? {},
        required: dereferenced.required,
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
