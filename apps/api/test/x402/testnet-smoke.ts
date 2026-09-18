/**
 * Real Algorand Testnet x402 payment smoke test.
 *
 * NOT part of `pnpm test`. Run explicitly via `pnpm test:x402:testnet`, and
 * only when you have a funded Testnet Algorand account with Testnet USDC
 * (ASA 10458941). It makes a real, small (PRICE_WEATHER) payment through the
 * real, configured GoPlausible facilitator - see .env.example's
 * TESTNET_FACILITATOR_URL / TESTNET_PAY_TO.
 *
 * Required environment variable (never commit this):
 *   TESTNET_TEST_PAYER_PRIVATE_KEY - base64-encoded 64-byte Algorand key
 *     (32-byte seed + 32-byte public key) for a funded Testnet test account.
 *     Generate one with any Algorand SDK/wallet; fund it via the Testnet
 *     dispenser (https://bank.testnet.algorand.network/) and a Testnet USDC
 *     faucet, then export it as an environment variable in your own shell -
 *     never write it to a file inside this repository.
 *
 * Flow (per the phase spec): unpaid request → 402 → client builds and signs
 * a real payment → retry with payment proof → verified paid response.
 */
import { ExactAvmScheme } from '@x402/avm/exact/client';
import { toClientAvmSigner } from '@x402/avm';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import { createApp } from '../../src/bootstrap.js';
import { X402ConfigService } from '../../src/config/x402-config.service.js';
import { CapabilityRegistryService } from '../../src/capabilities/capability-registry.service.js';
import { buildHttpFacilitatorClient, installX402Middleware } from '../../src/x402/index.js';

const TEST_CAPABILITY_PATH = '/v1/weather';
const TEST_PAYLOAD = { latitude: 6.5244, longitude: 3.3792 };

async function main(): Promise<void> {
  const privateKeyBase64 = process.env.TESTNET_TEST_PAYER_PRIVATE_KEY;
  if (!privateKeyBase64) {
    console.error(
      'TESTNET_TEST_PAYER_PRIVATE_KEY is not set - see the header of this file for how to obtain a funded ' +
        'Testnet test account. Refusing to run.',
    );
    process.exitCode = 1;
    return;
  }

  const app = await createApp();
  const x402Config = app.get(X402ConfigService);
  if (x402Config.network !== 'testnet') {
    console.error(`NETWORK must be "testnet" to run this script (currently "${x402Config.network}").`);
    process.exitCode = 1;
    await app.close();
    return;
  }

  const capabilityRegistry = app.get(CapabilityRegistryService);
  const facilitatorClient = buildHttpFacilitatorClient(x402Config.facilitatorUrl);
  await installX402Middleware(app, capabilityRegistry, x402Config, facilitatorClient);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  console.log(`[1/4] Requesting ${TEST_CAPABILITY_PATH} without payment...`);
  const unpaid = await app.inject({ method: 'POST', url: TEST_CAPABILITY_PATH, payload: TEST_PAYLOAD });
  if (unpaid.statusCode !== 402) {
    throw new Error(`Expected 402 for the unpaid request, got ${unpaid.statusCode}: ${unpaid.payload}`);
  }
  const paymentRequired = decodePaymentRequiredHeader(unpaid.headers['payment-required'] as string);
  const requirements = paymentRequired.accepts[0];
  console.log(`      Got 402. Required: ${requirements.amount} atomic units of asset ${requirements.asset} to ${requirements.payTo}`);

  console.log('[2/4] Building and signing a real Testnet payment...');
  const signer = toClientAvmSigner(privateKeyBase64);
  const clientScheme = new ExactAvmScheme(signer);
  const { payload: paymentPayload } = await clientScheme.createPaymentPayload(paymentRequired.x402Version, requirements);
  const paymentHeader = encodePaymentSignatureHeader({
    x402Version: paymentRequired.x402Version,
    accepted: requirements,
    payload: paymentPayload as unknown as Record<string, unknown>,
  });
  console.log(`      Signed payment from ${signer.address}`);

  console.log(`[3/4] Retrying ${TEST_CAPABILITY_PATH} with payment proof...`);
  const paid = await app.inject({
    method: 'POST',
    url: TEST_CAPABILITY_PATH,
    headers: { 'payment-signature': paymentHeader },
    payload: TEST_PAYLOAD,
  });
  if (paid.statusCode !== 200) {
    throw new Error(`Expected 200 for the paid request, got ${paid.statusCode}: ${paid.payload}`);
  }
  console.log('      Paid request succeeded.');

  console.log('[4/4] Checking settlement information...');
  const settlementHeader = paid.headers['payment-response'] as string | undefined;
  if (!settlementHeader) {
    throw new Error('Expected a Payment-Response settlement header on the paid response.');
  }
  const settlement = decodePaymentResponseHeader(settlementHeader);
  console.log(`      Settled: success=${settlement.success} transaction=${settlement.transaction}`);

  await app.close();
  console.log('\nTestnet x402 smoke test passed.');
}

main().catch((error: unknown) => {
  console.error('Testnet x402 smoke test failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
