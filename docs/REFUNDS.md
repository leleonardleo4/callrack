# Automatic refunds for failed paid requests

Callrack's x402 integration already guarantees, by construction, that a
capability which throws or returns a non-2xx status is never charged in the
first place: `@x402/avm`'s `exact` scheme settles payment **after** the
capability handler runs (the "authorization" payment flow), gated on the
response status — a failing status short-circuits settlement entirely, so
in the overwhelming majority of cases there is simply nothing to refund.

There is one real gap: a capability whose HTTP contract intentionally
returns `200` even when it failed. Today that's `/v1/research` — it always
returns `200` (documented, unchanged by this feature) because a *partial*
result (some sources failed, others succeeded) is a legitimate, successful
response. But when **every** requested source fails, the request was paid
for and settled, yet nothing of value was delivered. This is the invariant
the refund system exists to guarantee:

```text
successful payment + successful capability  = normal paid response
successful payment + failed capability      = buyer refund
payment verification/settlement failure     = no refund
settlement_pending                          = reconcile the original payment first, never blindly refund
```

## Where this lives

- `apps/api/src/x402/refund-response-hook.ts` — a Fastify `onSend` hook,
  registered in `install-x402-middleware.ts` **after** `@x402/fastify`'s own
  hook, so it always observes the final settlement outcome (the
  `PAYMENT-RESPONSE` header) and the final response status/body before
  anything is sent to the client. This is the single centralized decision
  point — no capability controller ever calls into the refund system
  directly.
- `apps/api/src/common/request-context/capability-outcome.ts` — lets a
  capability whose contract always returns 2xx (only `/v1/research` today)
  report "this specific request should be treated as failed" without
  changing its HTTP status contract. Every other capability needs no such
  call: a thrown exception or non-2xx response already prevents settlement.
- `apps/api/src/refunds/` — `RefundService` (eligibility, idempotency, the
  on-chain attempt), `AlgorandRefundClient` (the actual USDC transfer, via
  `@algorandfoundation/algokit-utils`), `RefundOrchestrationService` (the
  entry point the hook calls), `RefundReconcilerService` (durable retry).
- `packages/db/prisma/schema.prisma` — the `Refund` model and
  `RefundStatus` enum (`PENDING → PROCESSING → SUBMITTED → CONFIRMED`, or
  `FAILED`).

## Trust boundary

A refund is only ever computed from:

- the x402 facilitator's own settlement response (`SettleResponse`,
  decoded from the `PAYMENT-RESPONSE` header) — `transaction` (the
  idempotency key), `payer`, `network`, `amount`;
- the server's own configured payment requirements for that route —
  `asset`, `payTo`.

Never from the request body, query string, frontend state, or any
client-supplied field. `RefundService.checkEligibility` explicitly rejects:
an invalid/empty payer, the merchant address as its own payer, a
network/asset mismatch, and a non-positive amount — before a single atomic
unit moves.

## Server configuration

```env
TESTNET_REFUND_MNEMONIC=
MAINNET_REFUND_MNEMONIC=
```

Both optional. Only the *active* network's mnemonic is ever read or
validated. At startup, `RefundConfigService` derives the Algorand address
that mnemonic controls and requires it to equal the network's configured
`*_PAY_TO` — a refund can only be paid out of the same account that
received the original payment. A mismatch **fails startup immediately**. An
**unset** mnemonic does not fail startup: refunds are simply "disabled" for
that network — a failed paid request still gets a durable `PENDING` refund
row (nothing is ever silently dropped), it just can't be submitted on-chain
until an operator configures the mnemonic and restarts.

Never a private key/hex, never a mnemonic in frontend/client code, and
Testnet/Mainnet mnemonics are always two completely separate values.

## Idempotency

One original payment produces **at most one** refund, enforced at three
independent layers:

1. **Database**: `Refund.originalPaymentTransaction` has a unique
   constraint. `RefundService.getOrCreate` creates the row; on a unique
   violation it returns the existing row instead.
2. **Application**: `RefundService.attemptProcessing`'s claim is an atomic
   `updateMany({ where: { status: { in: ['PENDING','FAILED'] } } })`
   compare-and-swap — a second concurrent caller (another API instance, or
   the reconciler racing an inline attempt) claims 0 rows and does nothing.
3. **Algorand itself**: the refund transaction carries a deterministic
   `lease` (SHA-256 of the original payment's settlement transaction id).
   Algorand rejects a second transaction from the same sender with the same
   lease within the first one's validity window — so even a crash-and-retry
   that re-submits can only ever get one transfer confirmed on-chain.

## Durable retry

`RefundReconcilerService` polls the `Refund` table (not memory) every 15s
for `PENDING` rows, `FAILED` rows past their exponential backoff, and
`PROCESSING`/`SUBMITTED` rows stale for over 2 minutes (an interrupted
attempt). A server restart loses no state — the next boot's first tick
rediscovers everything from the database. `setInterval` is only the cadence
trigger; the database is the source of truth. A refund whose error message
matches a known non-retryable pattern (e.g. "must optin") is not retried
indefinitely.

## Settlement-pending protection

The x402 SDK's own facilitator retry mechanism reconciles a broadcast
transaction whose confirmation couldn't be established before ever
reporting settlement success or failure back to Callrack — the refund
system only ever runs once a settlement is reported successful, so a
pending settlement is never treated as chargeable, and never triggers a
refund on its own.

## Frontend

`apps/web/src/components/playground/PlaygroundResponsePanel.tsx` renders a
distinct "Payment successful / Capability failed / Refund confirmed
(pending)" block whenever the API response carries a `payment` field, with
a link to the real refund transaction on
[Lora](https://lora.algokit.io) once confirmed. Never fabricated — only
ever the exact values the API returned.
