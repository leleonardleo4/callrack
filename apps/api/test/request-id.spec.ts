import { describe, expect, it } from 'vitest';
import {
  generateRequestId,
  isValidRequestId,
  resolveRequestId,
} from '../src/common/http/request-id.util.js';

describe('RequestId Utility', () => {
  it('generates collision-resistant IDs starting with req_', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();

    expect(id1).toMatch(/^req_[a-f0-9]{32}$/);
    expect(id2).toMatch(/^req_[a-f0-9]{32}$/);
    expect(id1).not.toBe(id2);
  });

  it('validates request ID format strictly', () => {
    expect(isValidRequestId('req_123456')).toBe(true);
    expect(isValidRequestId('client-custom-id-99')).toBe(true);
    expect(isValidRequestId('invalid id with spaces')).toBe(false);
    expect(isValidRequestId('injection\r\nheader')).toBe(false);
    expect(isValidRequestId('')).toBe(false);
    expect(isValidRequestId(null)).toBe(false);
  });

  it('preserves valid client-provided request ID', () => {
    const clientId = 'trace-external-abc-123';
    const resolved = resolveRequestId(clientId);

    expect(resolved).toBe(clientId);
  });

  it('generates a new ID when client header is invalid or missing', () => {
    const missing = resolveRequestId(undefined);
    expect(missing).toMatch(/^req_[a-f0-9]{32}$/);

    const invalid = resolveRequestId('invalid <script> tag');
    expect(invalid).toMatch(/^req_[a-f0-9]{32}$/);
  });
});
