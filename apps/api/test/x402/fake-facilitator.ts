import { vi } from 'vitest';
import type { FacilitatorClient } from '@x402/core/server';
import type { Network, PaymentPayload, PaymentRequirements, SettleResponse, SupportedResponse, VerifyResponse } from '@x402/core/types';

/** The x402 protocol version this whole SDK generation speaks (see @x402/core/server). */
export const X402_PROTOCOL_VERSION = 2;

export interface FakeFacilitatorBehavior {
  verify?: VerifyResponse | ((payload: PaymentPayload, requirements: PaymentRequirements) => VerifyResponse | Promise<VerifyResponse>);
  settle?: SettleResponse | ((payload: PaymentPayload, requirements: PaymentRequirements) => SettleResponse | Promise<SettleResponse>);
}

export type FakeFacilitatorClient = FacilitatorClient & {
  verify: ReturnType<typeof vi.fn>;
  settle: ReturnType<typeof vi.fn>;
  getSupported: ReturnType<typeof vi.fn>;
};

/**
 * A deterministic, network-free FacilitatorClient for automated tests (see
 * Phase 7 spec §26: "Mock the facilitator for deterministic automated
 * tests"). Everything else in the request pipeline - the real
 * x402ResourceServer, x402HTTPResourceServer, ExactAvmScheme, and Fastify
 * middleware - runs unmodified; only the network call to the facilitator is
 * replaced.
 */
export function createFakeFacilitatorClient(
  network: Network,
  behavior: FakeFacilitatorBehavior = {},
): FakeFacilitatorClient {
  const verify = vi.fn(async (payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> => {
    if (typeof behavior.verify === 'function') {
      return behavior.verify(payload, requirements);
    }
    return behavior.verify ?? { isValid: true, payer: 'FAKEPAYERTESTONLYXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' };
  });

  const settle = vi.fn(async (payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> => {
    if (typeof behavior.settle === 'function') {
      return behavior.settle(payload, requirements);
    }
    return (
      behavior.settle ?? {
        success: true,
        transaction: 'FAKE_TEST_TRANSACTION_ID',
        network: requirements.network,
        payer: 'FAKEPAYERTESTONLYXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      }
    );
  });

  const getSupported = vi.fn(async (): Promise<SupportedResponse> => ({
    kinds: [{ x402Version: X402_PROTOCOL_VERSION, scheme: 'exact', network }],
    extensions: [],
    signers: {},
  }));

  return { verify, settle, getSupported };
}
