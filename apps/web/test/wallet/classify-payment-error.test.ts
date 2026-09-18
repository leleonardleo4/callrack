import { describe, expect, it } from 'vitest';
import {
  CallrackNetworkError,
  CallrackPaymentError,
  CallrackPaymentPolicyError,
  CallrackTimeoutError,
} from '@callrack/sdk';
import { classifyPaymentFlowError } from '@/wallet/classify-payment-error';

describe('classifyPaymentFlowError', () => {
  it('classifies a wallet-worded rejection as cancelled, with a plain user-facing message and a hint', () => {
    const failure = classifyPaymentFlowError(new Error('Transaction request was rejected by the user.'));
    expect(failure).toMatchObject({ reason: 'cancelled', message: 'Transaction cancelled.' });
    expect(failure.hint).toBeTruthy();
  });

  it('classifies a wallet-worded cancellation as cancelled', () => {
    const failure = classifyPaymentFlowError(new Error('User cancelled the request.'));
    expect(failure.reason).toBe('cancelled');
  });

  it('does not classify a server-side rejection as a user cancellation, even though it contains the word "rejected"', () => {
    const error = new CallrackPaymentError('Payment for /v1/weather was rejected by the server: insufficient fee');
    const failure = classifyPaymentFlowError(error);
    expect(failure.reason).not.toBe('cancelled');
  });

  it('surfaces the real CallrackPaymentError message verbatim for an otherwise-unclassified server rejection', () => {
    const error = new CallrackPaymentError('Payment for /v1/weather was rejected by the server: bad signature');
    const failure = classifyPaymentFlowError(error);
    expect(failure).toMatchObject({ reason: 'payment-rejected', message: error.message });
  });

  it('classifies a CallrackPaymentError mentioning balance/underflow as insufficient-balance, keeping the real message', () => {
    const error = new CallrackPaymentError('Payment for /v1/weather was rejected by the server: underflow on subtraction');
    const failure = classifyPaymentFlowError(error);
    expect(failure).toMatchObject({ reason: 'insufficient-balance', message: error.message });
  });

  it('classifies a "must optin" receiver simulation failure distinctly from a generic rejection, with an actionable hint', () => {
    // The exact real-world message this classification exists for (see the
    // Testnet debugging session that first surfaced it): the payTo account
    // configured server-side hasn't opted in to the USDC asset - nothing a
    // payer can fix, and not the same thing as their own low balance.
    const error = new CallrackPaymentError(
      'Payment for /v1/academic/search was rejected by the server: Transaction simulation failed: transaction ' +
        'CXKXNDSGI2UP34IUCMZGFKTWJAEAI4AQVYBB53CQI7JRD7XIVC6A: receiver error: must optin, asset 10458941 missing ' +
        'from ITGXWHD7YOC35LJ62SBSCQK5H5GP47WGMXEGLC3PB6FVXDRH3CTDFJBRQY',
    );
    const failure = classifyPaymentFlowError(error);
    expect(failure.reason).toBe('receiver-not-opted-in');
    expect(failure.message).toBe(error.message);
    expect(failure.hint).toMatch(/server configuration/i);
    expect(failure.hint).toMatch(/opt/i);
  });

  it('classifies a CallrackPaymentPolicyError (NO_ACCEPTABLE_PAYMENT_REQUIREMENT) as wrong-network and names the required network', () => {
    const error = new CallrackPaymentPolicyError('no match', { reason: 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT' });
    const failure = classifyPaymentFlowError(error, 'Algorand Testnet');
    expect(failure.reason).toBe('wrong-network');
    expect(failure.message).toContain('Algorand Testnet');
  });

  it('classifies any other CallrackPaymentPolicyError reason as a generic policy failure with the real message', () => {
    const error = new CallrackPaymentPolicyError('resource mismatch', { reason: 'RESOURCE_MISMATCH' });
    const failure = classifyPaymentFlowError(error);
    expect(failure).toMatchObject({ reason: 'policy', message: 'resource mismatch' });
  });

  it('classifies a CallrackNetworkError as network', () => {
    const error = new CallrackNetworkError('DNS lookup failed');
    expect(classifyPaymentFlowError(error)).toMatchObject({ reason: 'network', message: 'DNS lookup failed' });
  });

  it('classifies a CallrackTimeoutError as network', () => {
    const error = new CallrackTimeoutError('timed out', 30000);
    expect(classifyPaymentFlowError(error).reason).toBe('network');
  });

  it('classifies an unavailable-wallet message distinctly', () => {
    const failure = classifyPaymentFlowError(new Error('This wallet is not available in the current browser.'));
    expect(failure.reason).toBe('wallet-unavailable');
  });

  it('falls back to unknown for an unrecognized error, without fabricating a cause', () => {
    const failure = classifyPaymentFlowError(new Error('something completely unexpected'));
    expect(failure).toEqual({ reason: 'unknown', message: 'something completely unexpected' });
  });

  it('handles a non-Error throw value without crashing', () => {
    const failure = classifyPaymentFlowError('a plain string throw');
    expect(failure.message).toBe('a plain string throw');
  });
});
