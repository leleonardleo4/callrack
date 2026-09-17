import { z } from 'zod';
import { isValidAlgorandAddress } from '@x402/avm';

const SUPPORTED_NETWORKS = ['testnet', 'mainnet'] as const;
export type SupportedX402Network = (typeof SUPPORTED_NETWORKS)[number];

/**
 * Raw env shape: NETWORK is always required; the per-network PAY_TO /
 * FACILITATOR_URL pairs are optional at this layer (you don't need Mainnet
 * credentials to develop against Testnet) — `x402ConfigSchema` below requires
 * only whichever pair the active NETWORK actually needs.
 */
const rawX402ConfigSchema = z.object({
  NETWORK: z.enum(SUPPORTED_NETWORKS, {
    errorMap: () => ({ message: `NETWORK must be one of: ${SUPPORTED_NETWORKS.join(', ')}` }),
  }),
  TESTNET_PAY_TO: z.string().trim().optional(),
  MAINNET_PAY_TO: z.string().trim().optional(),
  TESTNET_FACILITATOR_URL: z.string().trim().optional(),
  MAINNET_FACILITATOR_URL: z.string().trim().optional(),
});

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Every paid Callrack capability shares this one `payTo` address on the
 * active network — the registry never carries per-capability addresses (see
 * capabilities/capability-definitions.ts).
 */
export const x402ConfigSchema = rawX402ConfigSchema.superRefine((data, ctx) => {
  const payToKey = data.NETWORK === 'testnet' ? 'TESTNET_PAY_TO' : 'MAINNET_PAY_TO';
  const facilitatorKey = data.NETWORK === 'testnet' ? 'TESTNET_FACILITATOR_URL' : 'MAINNET_FACILITATOR_URL';
  const payTo = data[payToKey];
  const facilitatorUrl = data[facilitatorKey];

  if (!payTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [payToKey],
      message: `${payToKey} is required when NETWORK=${data.NETWORK}`,
    });
  } else if (!isValidAlgorandAddress(payTo)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [payToKey],
      message: `${payToKey} must be a structurally valid Algorand address`,
    });
  }

  if (!facilitatorUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [facilitatorKey],
      message: `${facilitatorKey} is required when NETWORK=${data.NETWORK}`,
    });
  } else if (!isValidUrl(facilitatorUrl)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [facilitatorKey],
      message: `${facilitatorKey} must be a valid URL`,
    });
  }
});

export type X402Config = z.infer<typeof rawX402ConfigSchema>;

export function validateX402Config(rawEnv: Record<string, string | undefined> = process.env): X402Config {
  const result = x402ConfigSchema.safeParse(rawEnv);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`Callrack x402 configuration validation failed:\n${JSON.stringify(formatted, null, 2)}`);
  }
  return result.data;
}
