#!/usr/bin/env node
/**
 * Reference Callrack agent CLI/demo (Phase 10). Not a published product,
 * not a wallet — a minimal, honest demonstration that `CallrackAgentRuntime`
 * can plan a task against discovered capabilities, pay for them via x402
 * when a signer is configured, and track an exact budget end to end.
 *
 * Usage:
 *   pnpm --filter @callrack/agent dev -- "Research renewable energy investment in Africa"
 *
 * Reads its configuration from the monorepo root `.env` (see
 * .env.example's "Callrack SDK / reference agent" section):
 *   CALLRACK_API_URL       Base URL of the Callrack API. Default: http://localhost:3000
 *   AGENT_NETWORK          "testnet" (default) or "mainnet".
 *   AGENT_MAX_BUDGET_USDC  Task budget, decimal USDC. Default: 0.25
 *   AVM_MNEMONIC           Optional — without it, the agent runs in
 *                          discovery-only mode: paid capability calls
 *                          surface as errors instead of paying automatically.
 */
import { loadRootEnv } from '@callrack/config';
import { CallrackAgentRuntime, type CallrackNetwork } from '@callrack/sdk';
import { testnetSignerFromEnv } from '@callrack/sdk/testnet-signer';

function parseTask(argv: readonly string[]): string {
  const task = argv.slice(2).join(' ').trim();
  if (!task) {
    console.error('Usage: callrack-agent "<task description>"');
    process.exit(1);
  }
  return task;
}

function parseNetwork(value: string | undefined): CallrackNetwork {
  return value === 'mainnet' ? 'mainnet' : 'testnet';
}

async function main(): Promise<void> {
  loadRootEnv();

  const task = parseTask(process.argv);
  const baseUrl = process.env.CALLRACK_API_URL ?? 'http://localhost:3000';
  const network = parseNetwork(process.env.AGENT_NETWORK);
  const maxBudget = process.env.AGENT_MAX_BUDGET_USDC ?? '0.25';
  // testnetSignerFromEnv is a Testnet-only reference convenience (see its
  // own doc comment) — never wired to Mainnet, matching the "make
  // accidental Mainnet spending difficult" requirement below.
  const signer = network === 'testnet' ? testnetSignerFromEnv() : undefined;

  if (network === 'mainnet') {
    console.warn(
      '⚠️  AGENT_NETWORK=mainnet: this agent can spend real Mainnet USDC, up to the configured spend ' +
        'policy and task budget. This reference CLI has no Mainnet signer wired in — supply one via ' +
        'CallrackAgentRuntime’s `client.signer` option yourself if you intend to run it live.',
    );
  } else if (!signer) {
    console.log(
      'No signer configured (set AVM_MNEMONIC to pay automatically). Running in discovery-only mode — ' +
        'capability calls that require payment will surface as errors instead of paying.',
    );
  }

  console.log(`Callrack Agent — task: "${task}"`);
  console.log(`Network: ${network} | Budget: ${maxBudget} USDC | API: ${baseUrl}\n`);

  const runtime = new CallrackAgentRuntime({
    client: { baseUrl, network, signer },
    maxBudget,
    onEvent: (event) => {
      const suffix = event.capabilityId ? ` (${event.capabilityId})` : '';
      console.log(`[${event.type}]${suffix} ${event.message}`);
    },
  });

  const result = await runtime.run(task);

  console.log('\n--- Result ---');
  console.log(result.summary);
  console.log(
    `Budget: spent ${result.budget.spentAtomic} / ${result.budget.totalAtomic} atomic units ` +
      `(${result.budget.remainingAtomic} remaining)`,
  );
  for (const step of result.steps) {
    if (step.error) {
      console.log(`- ${step.toolId}: FAILED (${step.error})`);
    } else {
      console.log(`- ${step.toolId}: OK`);
      console.log(JSON.stringify(step.output, null, 2));
    }
  }
}

main().catch((error: unknown) => {
  console.error('Agent run failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
