import type { JsonSchemaProperty, RequestJsonSchema } from '@/types/capability';

/** How a schema field's control is rendered: never nested forms, so every value is form-control-friendly. */
export type FieldKind = 'string' | 'number' | 'boolean' | 'string-array' | 'json';

/** Form state always holds control-friendly primitives; arrays/objects are edited as text and parsed on submit. */
export type FormFieldValue = string | number | boolean;

function primaryType(schema: JsonSchemaProperty): string | undefined {
  if (typeof schema.type !== 'string') return schema.type?.find((t) => t !== 'null');
  return schema.type;
}

export function fieldKindFor(schema: JsonSchemaProperty): FieldKind {
  const type = primaryType(schema);
  if (type === 'boolean') return 'boolean';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'array' && primaryType(schema.items ?? {}) === 'string') return 'string-array';
  if (type === 'string') return 'string';
  return 'json';
}

function stringifyExampleValue(kind: FieldKind, value: unknown): FormFieldValue {
  if (kind === 'boolean') return Boolean(value);
  if (kind === 'number') return typeof value === 'number' ? value : Number(value ?? 0);
  if (kind === 'string-array') return Array.isArray(value) ? value.join(', ') : String(value ?? '');
  if (kind === 'json') return value === undefined ? '' : JSON.stringify(value, null, 2);
  return value === undefined || value === null ? '' : String(value);
}

/** Seeds form state from the capability's real example request, never blank placeholders where a real example exists. */
export function initFormState(
  schema: RequestJsonSchema,
  example: Record<string, unknown>,
): Record<string, FormFieldValue> {
  const state: Record<string, FormFieldValue> = {};
  for (const [name, fieldSchema] of Object.entries(schema.properties)) {
    const kind = fieldKindFor(fieldSchema);
    state[name] = stringifyExampleValue(kind, example[name]);
  }
  return state;
}

export interface BuildRequestBodySuccess {
  readonly ok: true;
  readonly body: Record<string, unknown>;
}

export interface BuildRequestBodyFailure {
  readonly ok: false;
  readonly field: string;
  readonly message: string;
}

/** Coerces the string-based form state back into a real JSON request body, per field schema type. */
export function buildRequestBody(
  schema: RequestJsonSchema,
  state: Record<string, FormFieldValue>,
): BuildRequestBodySuccess | BuildRequestBodyFailure {
  const body: Record<string, unknown> = {};
  const required = new Set(schema.required ?? []);

  for (const [name, fieldSchema] of Object.entries(schema.properties)) {
    const kind = fieldKindFor(fieldSchema);
    const raw = state[name];

    if (kind === 'string') {
      const value = String(raw ?? '').trim();
      if (value.length === 0) {
        if (required.has(name)) return { ok: false, field: name, message: `${name} is required.` };
        continue;
      }
      body[name] = value;
      continue;
    }

    if (kind === 'number') {
      if (raw === '' || raw === undefined) {
        if (required.has(name)) return { ok: false, field: name, message: `${name} is required.` };
        continue;
      }
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(value)) return { ok: false, field: name, message: `${name} must be a number.` };
      body[name] = value;
      continue;
    }

    if (kind === 'boolean') {
      body[name] = Boolean(raw);
      continue;
    }

    if (kind === 'string-array') {
      const items = String(raw ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length === 0) {
        if (required.has(name)) return { ok: false, field: name, message: `${name} is required.` };
        continue;
      }
      body[name] = items;
      continue;
    }

    // kind === 'json'
    const text = String(raw ?? '').trim();
    if (text.length === 0) {
      if (required.has(name)) return { ok: false, field: name, message: `${name} is required.` };
      continue;
    }
    try {
      body[name] = JSON.parse(text);
    } catch {
      return { ok: false, field: name, message: `${name} must be valid JSON.` };
    }
  }

  return { ok: true, body };
}
