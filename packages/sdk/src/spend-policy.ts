import type { Network, PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { convertToTokenAmount } from '@x402/avm';
import { isAtomicAmountWithin } from './money.js';
import type { ResolvedNetwork } from './network.js';

/**
 * A caller-configurable spend policy, validated before every payment signs.
 * Shape matches the SDK spec's own example
 * (`{ maxPayment, allowedNetworks, allowedAssets }`) rather than inventing a
 * parallel scheme — this sits alongside `@x402/core`'s own `SpendControls`
 * (see `X402PaymentClient`, which wires both: `SpendControls` for its
 * built-in per-asset caps, this for Callrack's resource/network/asset/amount
 * decision used by `selectAcceptablePaymentRequirement`).
 */
export interface CallrackSpendPolicy {
  /** Exact decimal USDC string cap per payment (e.g. "0.10") — never a float. */
  readonly maxPayment: string;
  /** CAIP-2 network ids this client is willing to pay on. */
  readonly allowedNetworks: readonly Network[];
  /** Asset ids (as advertised in payment requirements) this client is willing to pay with. */
  readonly allowedAssets: readonly string[];
}

/**
 * A safe-by-default policy scoped to exactly one resolved network's USDC
 * asset, capped at $1.00 — matching `@x402/core`'s own
 * `DEFAULT_MAX_AMOUNT_PER_PAYMENT`. A caller must explicitly widen this
 * (more networks, more assets, a higher cap) to pay for anything else; the
 * SDK never defaults to "any network, any asset, any amount".
 */
export function defaultSpendPolicy(resolved: ResolvedNetwork): CallrackSpendPolicy {
  return {
    maxPayment: '1.00',
    allowedNetworks: [resolved.caip2],
    allowedAssets: [resolved.usdcAssetId],
  };
}

export type SelectPaymentRequirementFailureReason = 'RESOURCE_MISMATCH' | 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT';

export type SelectPaymentRequirementResult =
  | { readonly ok: true; readonly requirement: PaymentRequirements }
  | { readonly ok: false; readonly reason: SelectPaymentRequirementFailureReason };

export interface SelectPaymentRequirementInput {
  readonly paymentRequired: PaymentRequired;
  /**
   * The exact URL the SDK itself intended to call. Validated against the
   * server's advertised resource — never the other way around — so a
   * compromised or misbehaving server cannot redirect payment to a resource
   * the caller never asked for.
   */
  readonly expectedResourceUrl: string;
  readonly policy: CallrackSpendPolicy;
  readonly usdcDecimals: number;
}

/**
 * Pure decision function: given a 402 response and a spend policy, either
 * returns the one payment requirement to pay (never `accepts[0]` blindly —
 * every entry is inspected), or a reason none was acceptable. Never signs,
 * never has side effects — safe to unit test directly and to call from
 * `X402PaymentClient`'s `onBeforePaymentCreation` hook.
 */
export function selectAcceptablePaymentRequirement(
  input: SelectPaymentRequirementInput,
): SelectPaymentRequirementResult {
  const { paymentRequired, expectedResourceUrl, policy, usdcDecimals } = input;

  if (paymentRequired.resource.url !== expectedResourceUrl) {
    return { ok: false, reason: 'RESOURCE_MISMATCH' };
  }

  const maxAtomic = convertToTokenAmount(policy.maxPayment, usdcDecimals);

  for (const requirement of paymentRequired.accepts) {
    if (requirement.scheme !== 'exact') continue;
    if (!policy.allowedNetworks.includes(requirement.network)) continue;
    if (!policy.allowedAssets.includes(requirement.asset)) continue;
    if (!isAtomicAmountWithin(requirement.amount, maxAtomic)) continue;
    return { ok: true, requirement };
  }

  return { ok: false, reason: 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT' };
}
