# @callrack/sdk

The official Callrack SDK: capability discovery, generic capability
invocation, transparent x402 (Algorand) payment handling, and a small
agent runtime built on top of it.

Not published yet (`private: true` in `package.json`). This README
describes the SDK as it exists in this repository, for use from other
workspace packages (`apps/agent`) and for local development.

## Installation

Within this monorepo, depend on it as a workspace package:

```json
{ "dependencies": { "@callrack/sdk": "workspace:*" } }
```

## Creating a client

```ts
import { CallrackClient } from '@callrack/sdk';

const client = new CallrackClient({
  baseUrl: 'http://localhost:3000', // defaults to this for local dev
  network: 'testnet', // defaults to 'testnet'
});
```

Never hardcode a production URL in application code - always pass
`baseUrl` from configuration.

## Capability discovery

Capability metadata always comes from the live `GET /v1/capabilities`
endpoint, never a bundled/hand-maintained registry:

```ts
const capabilities = await client.listCapabilities(); // cached until forceRefresh
const weather = await client.getCapability('weather');
```

Each `PublicCapability` includes `id`, `name`, `description`, `category`,
`method`, `path`, `price`, `status`, `requestSchema`, `responseSchema`, and
an `example` - never internal pricing keys or facilitator secrets.

## Calling a capability

Generic invocation works for any discovered capability, including ones the
SDK wasn't compiled against - this is how an agent calls capabilities it
only learned about at runtime:

```ts
const result = await client.call('news.search', { query: 'renewable energy', limit: 5 });
result.data; // typed as `unknown` for the generic path
result.meta.requestId;
```

A handful of headline capabilities also have typed convenience wrappers
(hand-written, not a generic capability-id-to-type system):

```ts
await client.weather({ latitude: 6.5244, longitude: 3.3792, days: 3 });
await client.news.search({ query: 'renewable energy Africa' });
await client.academic.search({ query: 'large language models healthcare' });
```

### Information capabilities

Deterministic, provenance-rich capabilities composed from the atomic ones
above - never an LLM, never a fabricated fact or citation (see the root
README's "Information Capabilities" section for how each actually works):

```ts
const result = await client.verify({ claim: 'Nigeria is the most populous country in Africa.' });
result.data.verdict; // "supported" | "contradicted" | "mixed" | "insufficient"
result.data.evidence; // EvidenceItem[] - the real evidence the verdict is based on

const evidence = await client.evidence({ query: 'renewable energy investment in Africa' });
evidence.data.findings; // EvidenceItem[] with full provenance

const comparison = await client.compare({ query: 'Tesla' });
comparison.data.subjects; // distinct subjects found, with which capabilities returned each

const research = await client.research({ query: 'renewable energy investment in Africa' });
research.data.findings; // the same evidence-item shape, alongside research's existing per-source `sources` map
research.data.composition; // which sources succeeded/were empty/failed, and when
```

## x402 payments

Every paid capability returns HTTP 402 with an x402 `PaymentRequired`
response until it's paid. Without a `signer`, `CallrackClient` surfaces
this as a `CallrackPaymentRequiredError` (with the live `resource` and
`accepts` list) instead of paying automatically:

```ts
import { CallrackPaymentRequiredError } from '@callrack/sdk';

try {
  await client.call('weather', { latitude: 6.5244, longitude: 3.3792 });
} catch (error) {
  if (error instanceof CallrackPaymentRequiredError) {
    console.log(error.accepts); // what the server will accept, right now
  }
}
```

Configure a `signer` to pay automatically. Payment orchestration (402
detection, signing, retry, double-payment protection) is delegated to the
official `@x402/fetch`/`@x402/core`/`@x402/avm` packages; the SDK's own
`X402PaymentClient` adds one policy layer on top - every payment
requirement is independently re-validated (resource, network, asset,
amount) against the request the SDK itself made, and a payment requirement
is never signed unless it passes:

```ts
import { testnetSignerFromEnv } from '@callrack/sdk/testnet-signer';

const client = new CallrackClient({
  baseUrl: 'http://localhost:3000',
  network: 'testnet',
  signer: testnetSignerFromEnv(), // undefined if AVM_MNEMONIC is unset
});

await client.weather({ latitude: 6.5244, longitude: 3.3792 }); // pays automatically
```

### Spending policy

```ts
import { defaultSpendPolicy } from '@callrack/sdk';

const client = new CallrackClient({
  network: 'testnet',
  signer,
  spendPolicy: {
    maxPayment: '0.10', // exact decimal USDC string per payment, never a float
    allowedNetworks: [/* CAIP-2 network id(s) */],
    allowedAssets: [/* asset id(s), e.g. the Testnet USDC ASA id */],
  },
});
```

Without an explicit `spendPolicy`, the client uses `defaultSpendPolicy` -
scoped to exactly its own configured network and USDC asset, capped at
$1.00 per payment. A client never pays on a network, asset, or amount
outside this policy, and never pays for a resource other than the one it
actually requested.

### Testnet setup

The reference Testnet signer derives a real Algorand signer from a 25-word
mnemonic. It's isolated in its own subpath export, is Node-only, and is
never imported by the core SDK:

```ts
import { testnetSignerFromMnemonic, testnetSignerFromEnv } from '@callrack/sdk/testnet-signer';
```

Set `AVM_MNEMONIC` in your environment (see the root `.env.example`).
**Never commit it, never log it, never send it to a frontend, and never use
a Mainnet-funded mnemonic in CI.**

### Mainnet safety

`network: 'mainnet'` is supported but never the default, and nothing about
using it relaxes spend-policy enforcement. This package has no Mainnet
signer helper - supplying one is a deliberate, explicit action for
whatever code constructs the client.

## Agent runtime

`CallrackAgentRuntime` (in `@callrack/sdk`'s `agent` exports) is a
reference, deterministic-planner implementation of `CallrackAgent`:

```ts
import { CallrackAgentRuntime } from '@callrack/sdk';

const runtime = new CallrackAgentRuntime({
  client: { baseUrl: 'http://localhost:3000', network: 'testnet', signer },
  maxBudget: '0.25', // exact decimal USDC task budget
  onEvent: (event) => console.log(event.type, event.message),
});

const result = await runtime.run('Research renewable energy investment in Africa');
result.steps; // which capabilities ran, with output or error
result.budget; // { totalAtomic, spentAtomic, remainingAtomic }
result.events; // the full structured, secret-free decision log
```

The planner is deterministic and keyword-based on purpose (`deterministicPlanner`,
`agent/planner.ts`) - this phase is the SDK/agent foundation, not planning
intelligence. Pass your own `planner: (task, tools) => PlannedStep[]` to
replace it, including with a future LLM-backed one, without changing
anything else.

Tools exposed to the agent (`AgentTool`) name Callrack capabilities only
(`academic.search`, `news.search`, `information.verify`, `information.evidence`,
`information.compare`, ...) - never the upstream provider behind them
(OpenAlex, GDELT, ...). The default planner already recognizes verification
("verify", "confirm", "fact-check"), evidence-gathering ("evidence", "proof"),
and comparison ("compare", "versus") tasks, in addition to its existing
academic/news/census rules.

See `apps/agent` for a runnable reference CLI built on this runtime.

## Testing

```
pnpm test                    # mocked, no real network or blockchain calls
pnpm test:agent:testnet      # real Testnet payments; opt-in, env-gated
```

`pnpm test:agent:testnet` only runs when `AVM_MNEMONIC` is set; otherwise
it prints what's missing and exits without failing your normal test run.
It is never part of `pnpm test` / `pnpm build` / `pnpm lint` / `pnpm typecheck`.

## Errors

`CallrackError` and its subclasses (`CallrackNetworkError`,
`CallrackTimeoutError`, `CallrackValidationError`, `CallrackApiError`,
`CallrackPaymentRequiredError`, `CallrackPaymentPolicyError`,
`CallrackPaymentError`) carry `requestId` and `capabilityId` where known,
for correlating with server-side logs - never a private key, mnemonic, or
payment signature.
