import { Injectable, Logger, type OnModuleInit, Optional } from '@nestjs/common';
import algosdk from 'algosdk';
import { X402ConfigService } from './x402-config.service.js';
import { type RefundConfig, validateRefundConfig } from './refund-config.schema.js';

/** Derives the Algorand address a 25-word mnemonic controls - pure/local, no network call. */
export function deriveAlgorandAddressFromMnemonic(mnemonic: string): string {
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  return account.addr.toString();
}

/**
 * Resolves and validates the merchant refund signer for whichever network
 * is active (Callrack only ever runs one network per instance - see
 * X402ConfigService). Testnet and Mainnet mnemonics are two entirely
 * separate env vars, never shared or derived from one another.
 *
 * By design, this NEVER fails startup just because no refund mnemonic is
 * configured - refunds are then simply "disabled": a failed paid capability
 * still gets a durable `PENDING` Refund row (RefundService doesn't need a
 * working signer to persist intent), it just can't be submitted on-chain
 * until an operator configures one and restarts. This matters because most
 * of this codebase's own tests boot the full app with no refund
 * configuration at all.
 *
 * It DOES fail startup - fast, loudly - the moment a mnemonic IS configured
 * but derives an address other than the network's configured `payTo`. A
 * refund can only ever be paid out of the same account that received the
 * original payment; a signer for an unrelated wallet must never be allowed
 * to run, since it would either silently do nothing (insufficient funds/not
 * opted in) or, worse, be a live misconfiguration nobody is watching.
 */
@Injectable()
export class RefundConfigService implements OnModuleInit {
  private readonly logger = new Logger(RefundConfigService.name);
  private readonly config: RefundConfig;
  private mnemonic: string | undefined;

  constructor(
    private readonly x402Config: X402ConfigService,
    @Optional() customEnv?: Record<string, string | undefined>,
  ) {
    this.config = validateRefundConfig(customEnv ?? process.env);
  }

  onModuleInit(): void {
    const network = this.x402Config.network;
    const mnemonic =
      network === 'testnet' ? this.config.TESTNET_REFUND_MNEMONIC : this.config.MAINNET_REFUND_MNEMONIC;

    if (!mnemonic) {
      this.logger.warn(
        `No refund signer configured for network "${network}" (set ${network === 'testnet' ? 'TESTNET_REFUND_MNEMONIC' : 'MAINNET_REFUND_MNEMONIC'} to enable automatic on-chain refunds). ` +
          'Failed paid requests will still be recorded as a pending refund, but cannot be submitted until this is configured.',
      );
      return;
    }

    const derivedAddress = deriveAlgorandAddressFromMnemonic(mnemonic);
    const payTo = this.x402Config.payTo;
    if (derivedAddress !== payTo) {
      throw new Error(
        `Refund signer misconfiguration on network "${network}": the account derived from the refund mnemonic ` +
          `(${derivedAddress}) does not control the configured payTo account (${payTo}). A refund can only be ` +
          'paid out of the same account that receives payments. Fix the mnemonic (or payTo) before starting.',
      );
    }

    this.mnemonic = mnemonic;
    this.logger.log(`Refund signer verified for network "${network}": controls the configured payTo account.`);
  }

  /** True once a refund signer has been configured AND verified to control `payTo` for the active network. */
  get isEnabled(): boolean {
    return this.mnemonic !== undefined;
  }

  /** The active network's payTo account - refunds are always paid from and validated against this address. */
  get merchantAddress(): string {
    return this.x402Config.payTo;
  }

  /** Throws with a clear, actionable message if refunds aren't enabled - never returns an empty/undefined signer. */
  getSignerMnemonicOrThrow(): string {
    if (!this.mnemonic) {
      throw new Error(
        `No refund signer is configured for network "${this.x402Config.network}". Set ` +
          `${this.x402Config.network === 'testnet' ? 'TESTNET_REFUND_MNEMONIC' : 'MAINNET_REFUND_MNEMONIC'} and restart.`,
      );
    }
    return this.mnemonic;
  }
}
