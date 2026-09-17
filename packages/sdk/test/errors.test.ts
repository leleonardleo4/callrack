import { describe, expect, it } from 'vitest';
import {
  CallrackApiError,
  CallrackError,
  CallrackNetworkError,
  CallrackPaymentPolicyError,
  CallrackPaymentRequiredError,
  CallrackTimeoutError,
  CallrackValidationError,
  isCallrackError,
} from '../src/errors.js';

describe('CallrackError hierarchy', () => {
  it('carries requestId and capabilityId through every subclass', () => {
    const error = new CallrackApiError('boom', { status: 500, requestId: 'req_1', capabilityId: 'weather' });
    expect(error.requestId).toBe('req_1');
    expect(error.capabilityId).toBe('weather');
    expect(error.status).toBe(500);
    expect(error).toBeInstanceOf(CallrackError);
  });

  it('isCallrackError narrows only real CallrackError instances', () => {
    expect(isCallrackError(new CallrackNetworkError('offline'))).toBe(true);
    expect(isCallrackError(new Error('plain'))).toBe(false);
    expect(isCallrackError('not an error')).toBe(false);
  });

  it('CallrackTimeoutError records the timeout duration', () => {
    const error = new CallrackTimeoutError('timed out', 5000);
    expect(error.timeoutMs).toBe(5000);
    expect(error).toBeInstanceOf(CallrackNetworkError);
  });

  it('CallrackPaymentPolicyError records the rejection reason and offending requirement', () => {
    const requirement = { scheme: 'exact', network: 'algorand:test', asset: '10458941', amount: '10000', payTo: 'ADDR' };
    const error = new CallrackPaymentPolicyError('rejected', { reason: 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT', requirement });
    expect(error.reason).toBe('NO_ACCEPTABLE_PAYMENT_REQUIREMENT');
    expect(error.requirement).toEqual(requirement);
  });

  it('CallrackPaymentRequiredError exposes the live resource and accepts list', () => {
    const error = new CallrackPaymentRequiredError('payment required', {
      resource: 'http://localhost:3000/v1/weather',
      accepts: [{ scheme: 'exact', network: 'algorand:test', asset: '10458941', amount: '10000', payTo: 'ADDR' }],
    });
    expect(error.resource).toBe('http://localhost:3000/v1/weather');
    expect(error.accepts).toHaveLength(1);
  });

  it('never puts secret-shaped fields on a validation error', () => {
    const error = new CallrackValidationError('bad input', { capabilityId: 'weather' });
    expect(Object.keys(error)).not.toContain('mnemonic');
    expect(Object.keys(error)).not.toContain('privateKey');
  });
});
