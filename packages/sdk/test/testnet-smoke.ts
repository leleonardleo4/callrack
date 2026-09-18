/**
 * Real Algorand Testnet x402 payment smoke test for the Callrack SDK's
 * agent runtime.
 *
 * NOT part of `pnpm test`. Run explicitly via `pnpm test:agent:testnet`,
 * and only when you have a funded Testnet Algorand account with Testnet
 * USDC (ASA 10458941) and a running Callrack API to call against.
 *
 * Environment variables (never commit real values for these; see
 * .env.example):
 *   AVM_MNEMONIC          25-word Algorand mnemonic for a funded Testnet
 *                          account. Required — the script exits cleanly,
 *                          explaining what's missing, if this is unset.
 *   CALLRACK_API_URL      Base URL of a running Callrack API.
 *                          Default: http://localhost:3000
 *   AGENT_MAX_BUDGET_USDC Task budget, decimal USDC. Default: 0.25
 *
 * Flow (mirrors CallrackAgentRuntime.run() exactly — this script does not
 * reimplement any of it): discover capabilities -> plan a task -> per-call
 * 402 -> policy check -> sign a real Testnet payment -> retry -> result ->
 * budget accounting.
 */
import { loadRootEnv } from '@callrack/config';
import { CallrackAgentRuntime } from '../src/agent/runtime.js';
import { testnetSignerFromEnv } from '../src/testnet-signer.js';

async function main(): Promise<void> {
  // tsx does not load .env files itself; this walks up to the monorepo
  // root and loads it, same as apps/api/src/main.ts and apps/agent/src/cli.ts,
  // so AVM_MNEMONIC (and the other variables below) are actually populated
  // regardless of which directory this script is invoked from.
  loadRootEnv();

  const signer = testnetSignerFromEnv();
  if (!signer) {
    console.log(
      'Testnet agent smoke test skipped: set AVM_MNEMONIC (a funded Testnet Algorand mnemonic) to run it. ' +
        'See .env.example for the full list of variables this script reads.',
    );
    return;
  }

  const baseUrl = process.env.CALLRACK_API_URL ?? 'http://localhost:3000';
  const maxBudget = process.env.AGENT_MAX_BUDGET_USDC ?? '0.25';

  console.log(`[1/3] Running the reference agent against ${baseUrl} (Testnet, budget ${maxBudget} USDC)...`);
  const runtime = new CallrackAgentRuntime({
    client: { baseUrl, network: 'testnet', signer },
    maxBudget,
    onEvent: (event) => console.log(`      [${event.type}] ${event.message}`),
  });

  const result = await runtime.run('Find recent news coverage of renewable energy investment in Africa');

  console.log('[2/3] Verifying at least one capability call was paid and completed...');
  const paidSteps = result.steps.filter((step) => step.error === undefined);
  if (paidSteps.length === 0) {
    throw new Error(`No capability call succeeded. Steps: ${JSON.stringify(result.steps, null, 2)}`);
  }
  console.log(`      ${paidSteps.length} capability call(s) completed. Spent ${result.budget.spentAtomic} atomic units.`);

  console.log('[3/3] Confirming no secrets leaked into the event log...');
  const serialized = JSON.stringify(result.events);
  if (/mnemonic|privatekey|signtransactions/i.test(serialized)) {
    throw new Error('Event log appears to contain secret-shaped data — refusing to print it.');
  }

  console.log(`\nTestnet agent smoke test passed. Summary: ${result.summary}`);
}

main().catch((error: unknown) => {
  console.error('Testnet agent smoke test failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
