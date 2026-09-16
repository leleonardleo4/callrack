import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_RESPONSE_HEADER = 'X-Request-ID';

// Sanitization regex: alphanumeric, dashes, and underscores only, length 1-128
const VALID_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function generateRequestId(): string {
  return `req_${randomUUID().replace(/-/g, '')}`;
}

export function isValidRequestId(id: unknown): id is string {
  return typeof id === 'string' && VALID_REQUEST_ID_REGEX.test(id);
}

export function resolveRequestId(incoming?: string | string[]): string {
  if (!incoming) {
    return generateRequestId();
  }

  const raw = Array.isArray(incoming) ? incoming[0] : incoming;
  const trimmed = raw?.trim();

  if (trimmed && isValidRequestId(trimmed)) {
    return trimmed;
  }

  return generateRequestId();
}
