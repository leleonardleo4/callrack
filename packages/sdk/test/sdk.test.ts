import { describe, expect, it } from 'vitest';
import { CallrackClient } from '../src';

describe('CallrackClient SDK foundation', () => {
  it('initializes client with default options', () => {
    const client = new CallrackClient();
    expect(client.getBaseUrl()).toBe('http://localhost:3000');
  });

  it('initializes client with custom base URL', () => {
    const client = new CallrackClient({ baseUrl: 'https://api.callrack.dev' });
    expect(client.getBaseUrl()).toBe('https://api.callrack.dev');
  });
});
