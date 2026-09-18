import { z } from 'zod';

/**
 * Refund signer config is intentionally OPTIONAL at this layer, per network
 * - unlike x402's own PAY_TO/FACILITATOR_URL, a Callrack deployment with no
 * refund mnemonic configured is a valid (if degraded) state: automatic
 * refunds simply cannot be *submitted* yet, but a failed paid capability
 * still gets a durable `PENDING` Refund row (see RefundService) rather than
 * being silently dropped. RefundConfigService fails startup only when a
 * mnemonic IS configured but doesn't control the network's payTo account -
 * never merely for being absent (see its own docs).
 */
const rawRefundConfigSchema = z.object({
  TESTNET_REFUND_MNEMONIC: z.string().trim().optional(),
  MAINNET_REFUND_MNEMONIC: z.string().trim().optional(),
});

export type RefundConfig = z.infer<typeof rawRefundConfigSchema>;

export function validateRefundConfig(rawEnv: Record<string, string | undefined> = process.env): RefundConfig {
  const result = rawRefundConfigSchema.safeParse(rawEnv);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`Callrack refund configuration validation failed:\n${JSON.stringify(formatted, null, 2)}`);
  }
  return result.data;
}
