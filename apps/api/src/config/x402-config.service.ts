import { Injectable, Optional } from '@nestjs/common';
import { ALGORAND_MAINNET_GENESIS_HASH, ALGORAND_TESTNET_GENESIS_HASH } from '@x402/avm';
import type { Network } from '@x402/core/types';
import { type SupportedX402Network, type X402Config, validateX402Config } from './x402.schema.js';

/** Everything the x402 integration needs to protect a route on the active network. */
export interface ActiveX402NetworkConfig {
  readonly network: SupportedX402Network;
  /** CAIP-2 network identifier from @x402/avm - never hand-rolled. */
  readonly caip2Network: Network;
  readonly payTo: string;
  readonly facilitatorUrl: string;
}

/**
 * @x402/avm exports the Algorand CAIP-2 identifier in two equivalent forms:
 * the short, truncated `ALGORAND_*_CAIP2` constants, and the full genesis
 * hash (`ALGORAND_*_GENESIS_HASH`). The GoPlausible facilitator mandated by
 * the Algorand x402 challenge currently advertises support using the full
 * genesis-hash form in its `/supported` response (verified directly against
 * https://facilitator.goplausible.xyz/supported), so that's the form used
 * here - both are official package exports, not hand-rolled identifiers.
 */
function toNetwork(genesisHash: string): Network {
  return `algorand:${genesisHash}`;
}

function resolveActive(config: X402Config): ActiveX402NetworkConfig {
  const network = config.NETWORK;
  const payTo = network === 'testnet' ? config.TESTNET_PAY_TO : config.MAINNET_PAY_TO;
  const facilitatorUrl = network === 'testnet' ? config.TESTNET_FACILITATOR_URL : config.MAINNET_FACILITATOR_URL;

  // Guaranteed present by x402ConfigSchema's superRefine - this is a type
  // narrowing, not a runtime check.
  if (!payTo || !facilitatorUrl) {
    throw new Error(`Missing resolved x402 configuration for network "${network}"`);
  }

  return {
    network,
    caip2Network: toNetwork(network === 'testnet' ? ALGORAND_TESTNET_GENESIS_HASH : ALGORAND_MAINNET_GENESIS_HASH),
    payTo,
    facilitatorUrl,
  };
}

/** Validated at construction - invalid or missing payment configuration fails app startup immediately. */
@Injectable()
export class X402ConfigService {
  private readonly config: X402Config;
  private readonly active: ActiveX402NetworkConfig;

  constructor(@Optional() customEnv?: Record<string, string | undefined>) {
    this.config = validateX402Config(customEnv ?? process.env);
    this.active = resolveActive(this.config);
  }

  get network(): SupportedX402Network {
    return this.active.network;
  }

  get caip2Network(): Network {
    return this.active.caip2Network;
  }

  get payTo(): string {
    return this.active.payTo;
  }

  get facilitatorUrl(): string {
    return this.active.facilitatorUrl;
  }

  /** The fully-resolved configuration for whichever network is currently active. */
  get activeNetworkConfig(): ActiveX402NetworkConfig {
    return this.active;
  }

  get raw(): X402Config {
    return this.config;
  }
}
