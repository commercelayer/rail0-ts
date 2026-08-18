# @rail0/sdk

TypeScript SDK for the [RAIL0](https://github.com/commercelayer/rail0) stablecoin payment gateway.

RAIL0 brings the authorize → capture → refund lifecycle of card networks to stablecoin payments — no intermediaries, no protocol fees. This SDK is a fully-typed REST client for the RAIL0 gateway in front of the contract, with access to every operation, plus client-side EIP-3009 / EIP-1559 signing helpers (via `@noble` — no ethers/viem dependency). It mirrors the [rail0-go](https://github.com/commercelayer/rail0-go) SDK surface.

## Requirements

- Node.js ≥ 22
- TypeScript ≥ 6 (for TypeScript projects)

## Installation

```bash
npm install @rail0/sdk
# or
pnpm add @rail0/sdk
```

## Quick start

```typescript
import { packSignature, Rail0Client, signPayment, signTransaction } from '@rail0/sdk'

const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })

// 1. Buyer creates the payment (mode: authorize → escrow).
const payment = await client.payments.create({
  chain_id: 8453,
  mode: 'authorize',
  amount: '50.00', // human decimal — the gateway converts to base units
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payer: '0xBuyer...',
  payee: '0xMerchant...',
})

// 2. Buyer signs the EIP-3009 payload the gateway returned, then stores it.
const sig = signPayment(BUYER_KEY, payment) // { v, r, s }
await client.payments.sign(payment.rail0_id, { signature: packSignature(sig) })

// 3. Payee authorizes: prepare → sign the EIP-1559 tx → submit (funds → escrow).
const authPrep = await client.payments.authorizePrepare(payment.rail0_id)
await client.payments.authorize(payment.rail0_id, {
  signed_transaction: signTransaction(authPrep.unsigned_transaction!, PAYEE_KEY),
})

// 4. Payee captures once the order is fulfilled.
const capPrep = await client.payments.capturePrepare(payment.rail0_id, '50.00')
await client.payments.capture(payment.rail0_id, {
  signed_transaction: signTransaction(capPrep.unsigned_transaction!, PAYEE_KEY),
})

// Inspect live state at any point.
const detail = await client.payments.get(payment.rail0_id)
console.log(detail.status, detail.capturable_amount, detail.refundable_amount)
```

See [`examples/`](examples) for authorize+capture, charge, refund, dispute, and webhooks.

## Payment lifecycle

Each on-chain operation is a two-step **prepare → submit**:

1. **Prepare** — `POST /payments/:id/:op/prepare` — returns a `Transaction` whose `unsigned_transaction` you sign (EIP-1559) with `signTransaction`.
2. **Submit** — `POST /payments/:id/:op` with `{ signed_transaction }` — broadcasts it (HTTP 202, async). Poll `get()` until the status settles.

When a wallet like **MetaMask** signs and broadcasts in one step (so you never hold the raw signed tx), report the resulting hash instead: **submit-by-hash** — `POST /payments/:id/:op/submitted` with `{ transaction_hash }` via `submitByHash(id, op, { transaction_hash })` (payee-only for the merchant ops; `release` accepts either participant). A **buyer** does the same for its own operations with `disputeSubmitByHash(id, { transaction_hash })` and `closeDisputeSubmitByHash(id, { transaction_hash })` (payer-only).

The `:id` accepts **either** the payment's UUID **or** its `rail0_id` (the contract's bytes32 id) — the gateway resolves both.

Payment status values: `unsigned`, `signed`, `authorized`, `charged`, `captured`, `partially_captured`, `voided`, `released`, `refunded`, `partially_refunded`. Status changes are happy-path — a payment only leaves its state to *close*: `partially_refunded` is legacy and no longer produced (a partial refund leaves the status unchanged).

| Operation | Caller | What it does |
|-----------|--------|--------------|
| `authorizePrepare` + `authorize` | payee | Broadcast the authorize tx; funds move to escrow |
| `chargePrepare` + `charge` | payee | One-shot authorize + capture, no escrow window |
| `capturePrepare` + `capture` | payee | Move escrowed funds to the merchant (partial supported) |
| `voidPrepare` + `void` | payee | Cancel the hold, return funds to the payer — **only before any capture** (else the contract reverts `AlreadyCaptured`) |
| `releasePrepare` + `release` | anyone | Return the uncaptured escrow after expiry; closes as `released` only on a **total** release (untouched authorization), else status unchanged |
| `refundPrepare` + `refund` | payee | Two-phase EIP-3009 `receiveWithAuthorization` refund; closes as `refunded` only when **fully settled**, else status unchanged |
| `disputePrepare` + `dispute` | payer | Open a dispute (signal-only) |
| `closeDisputePrepare` + `closeDispute` | payer | Close an open dispute |

## Signing helpers

All client-side, over `@noble` (no ethers/viem).

| Helper | Use |
|--------|-----|
| `signPayment(key, paymentDetail)` | Payer signs the EIP-3009 payload from `create()` (authorize or charge) |
| `signRefund(key, transaction)` | Payee signs the refund payload from `refundPrepare` phase-1 |
| `packSignature(sig)` | Turn a `{ v, r, s }` into the `0x` r‖s‖v hex every `signature` field expects |
| `signTransaction(unsignedJson, key)` | Sign an unsigned EIP-1559 tx from any prepare step → raw hex for submit |
| `signAuthorize` / `signCharge` | Lower-level EIP-3009 signers from explicit params |
| `signTransferWithAuthorization` / `signReceiveWithAuthorization` | Raw EIP-3009 transfer / receive signers |
| `buildSiweMessage(params)` | Build the EIP-4361 text for a login or a wallet proof-of-ownership |

`signPayment` / `signRefund` need only the `signing_payload` field, so they accept
any `{ signing_payload }` — a whole `PaymentDetail`/`Transaction`, or just the
payload holder. An unrecognised `primaryType` **throws** rather than defaulting to
the transfer typehash: the gateway's payload is signed verbatim, never rebuilt
client-side.

## Amounts

Amounts you **send** (`create`, `capturePrepare`, `refundPrepare`) are human
decimal strings (`'50.00'`) — the gateway converts them to base units using the
token's decimals. Amounts you **read** back (`amount`, `capturable_amount`,
`refundable_amount`, analytics volumes, the `min_amount`/`max_amount` list
filters) are base-unit integer strings (`'50000000'`).

Rendering one needs the token's `decimals`, and those resolve from `token`
**together with** `chain_id` — a token address identifies a token only within one
chain. Both fields are on every `Payment`, list rows included, so displaying an
amount from `list()` never needs a per-row `get(id)`.

Convert between a human decimal and the token's base-unit integer string, with
string/BigInt math (no float rounding):

```typescript
import { toBaseUnits, formatAmount } from '@rail0/sdk'

toBaseUnits('1.50', 6) // → '1500000'   (USDC has 6 decimals)
formatAmount('1500000', 6) // → '1.5'   (trailing zeros trimmed)
```

Fractional digits beyond `decimals` are truncated; a malformed amount throws.

## API reference

### `new Rail0Client(options)`

```typescript
const client = new Rail0Client({
  baseUrl:    'https://api.rail0.xyz',
  headers:    { Authorization: 'Bearer ...' }, // optional (required for authed endpoints)
  timeout:    30_000,                          // ms, default 30 000
  maxRetries: 3,                               // default 0 (network errors only)
  retryDelay: 200,                             // ms base, doubles each attempt
  retryOn429: false,                           // retry a rate limit (default false)
  retryAfterCapMs: 60_000,                     // longest Retry-After to honour
  signal:     controller.signal,               // optional — cancels the request and any wait
  logger:     debugLogger,                     // optional — see Logging
})
```

#### Rate limits

The gateway throttles the public surface **per IP** (100 requests / 60s by default) and
everything authenticated **per session**, keyed on the JWT subject (300 / 60s). Over
budget it answers **429** with `code: "rate_limited"`, a `Retry-After`, and (since
rail0-gateway#201) `RateLimit-Limit`/`-Remaining`/`-Reset` on *every* response so you can
pace instead of discovering the wall.

`Rail0ApiError.retryAfter` carries the header in seconds. Read it when you handle the
error yourself:

```typescript
try {
  await client.payments.list()
} catch (err) {
  if (err instanceof Rail0ApiError && err.status === 429) {
    await new Promise((r) => setTimeout(r, (err.retryAfter ?? 5) * 1000))
  }
}
```

`retryOn429: true` makes the client do that waiting — `Retry-After`, clamped to
`retryAfterCapMs`, plus a little jitter (callers sharing one session are told the same
number and would otherwise wake in lockstep). It is **off by default** on purpose: an
automatic sleep hides back-pressure from the code that could react to it, and in a browser
it turns a rate limit into a frozen click. It also works on its own — you do not need
`maxRetries` as well, which would have made the flag a silent no-op.

A **429 is the only HTTP status this client retries**, on any method including `POST`,
because the gateway rejects it in middleware *before* the request reaches the application:
nothing ran, so nothing can run twice. That is not true of a 502 or a timeout on a
capture, where the broadcast may already be in flight — those are never retried.

`signal` cancels the request **and any retry that is waiting**, which matters precisely
because `retryOn429` can hold a promise for up to a minute.

Resources: `client.payments`, `client.wallets`, `client.paymentMethods`, `client.webhooks`, `client.disputes`, `client.analytics`, `client.chains`, `client.tokens`, `client.health`, `client.auth`.

`setAuthToken(jwt)` sets (or, with `null`/`undefined`, clears) the `Authorization: Bearer …` header on every subsequent request — call it after `auth.login()` to authenticate a long-lived client without reconstructing it:

```typescript
const { token } = await client.auth.login(privateKeyHex, 'api.rail0.xyz')
client.setAuthToken(token) // now client.analytics/webhooks/… are authenticated
```

### `client.payments`

`create(params, idempotencyKey?)` → `PaymentDetail` (pass `idempotencyKey` to make the create replay-safe — the key is bound to the request, so reusing it with different terms is a `422 idempotency_key_reused`, not a silent replay of the first payment) · `get(id)` → `PaymentDetail` (status + live `capturable_amount`/`refundable_amount` + `transactions`) · `list(params?)` → `PaginatedResponse<Payment>` (JWT) · `transactions(id, params?)` → `PaginatedResponse<Transaction>` · `sign(id, { signature })` → `PaymentDetail` · `disputes(id, params?)` → `PaginatedResponse<Dispute>`.

Prepare/submit pairs (each prepare → `Transaction`, each submit → `Transaction`):
`authorizePrepare`/`authorize`, `chargePrepare`/`charge`, `capturePrepare(id, amount)`/`capture`, `voidPrepare`/`void`, `releasePrepare(id, from?)`/`release`, `refundPrepare(id, body)`/`refund`, `disputePrepare(id, reason?)`/`dispute`, `closeDisputePrepare(id, reason?)`/`closeDispute`. A generic `prepare(id, op, body?)` / `submit(id, op, params)` is also available, plus `submitByHash(id, op, { transaction_hash })` to record an already-broadcast tx by hash (MetaMask; payee-only, `release` either participant) and the payer-only `disputeSubmitByHash(id, { transaction_hash })` / `closeDisputeSubmitByHash(id, { transaction_hash })`.

**Refund** is two-phase: `refundPrepare(id, { amount })` returns a `Transaction` carrying a `signing_payload`; sign it with `signRefund`, then `refundPrepare(id, { amount, signature })` returns the unsigned on-chain tx to sign + `refund()`.

### `client.wallets` (scoped by account, JWT)

All wallet methods are behind SIWE — a merchant manages its **own** wallets. `list(accountId, params?)` → `PaginatedResponse<WalletWithTokens>` · `get(accountId, idOrAddress)` → `Wallet` · `create(accountId, { address, message, signature, label? })` → `Wallet` · `update(accountId, id, { label?, active? })` → `Wallet` · `delete(accountId, id)` → `void` · `balances(accountId, id, params?)` → `WalletBalances`.

Accepted tokens: `addToken(accountId, id, { chain_id, token, default? })` → `WalletTokenHolding` (upsert — reactivates a disabled holding instead of duplicating it) · `removeToken(accountId, id, tokenId)` → `void` (soft, keeps the row) · `enableToken(accountId, id, tokenId)` / `disableToken(accountId, id, tokenId)` → `WalletTokenHolding` (404 when the wallet has no holding for that token). `tokenId` is the **token's** UUID (as in `WalletTokenHolding.token.…`), not an id of the holding row.

A wallet with no accepted token is invisible to buyers and unusable as a payee: `GET /payment_methods` skips it and `payments.create` answers 422 `unsupported_payment_method`. Onboarding a merchant is therefore `create` **plus at least one** `addToken`.

Adding a wallet requires a **SIWE proof-of-ownership** of the address being added — not just the session JWT. Obtain a single-use nonce (`POST /auth/nonces`), build an EIP-4361 message whose `address` is the wallet being added, and sign it with **that wallet's own key** (the same handshake as login, but signed by the added wallet rather than the session wallet). Pass the resulting `message` + `signature` to `create`. The gateway rejects a signature that does not recover to `address` (422) and an address already registered anywhere (409 — addresses are globally unique). This lets a merchant prove control of several payee wallets under one account.

```ts
import { buildSiweMessage, checksumAddress, personalSign } from '@rail0/sdk'

const { nonce } = await client.auth.getNonce()
const added = checksumAddress(addedWalletKey)
// Build + sign an EIP-4361 message for the wallet being added (its OWN key).
// `address` must be EIP-55 checksummed and `uri`'s host must equal `domain`.
const message = buildSiweMessage({
  domain: 'api.rail0.xyz',
  address: added,
  uri: 'https://api.rail0.xyz',
  chainId: 1,
  nonce,
  statement: 'Sign in to RAIL0',
})
const signature = personalSign(addedWalletKey, message)
await client.wallets.create(accountId, { address: added, message, signature, label: 'Payouts' })
```

### `client.paymentMethods` (public)

Buyer-facing discovery of a merchant's accepted wallets/tokens — **no JWT**. `list(query)` → `WalletWithTokens[]`, where `query` is exactly one of `{ account_id }` (all the merchant's active wallets) or `{ address }` (just that one wallet). Maps the public `GET /payment_methods`; an unknown handle yields `[]`.

```ts
const methods = await client.paymentMethods.list({ address: '0xABC…' })
for (const w of methods) for (const h of w.tokens ?? []) {
  // pay h.token (h.token.symbol on h.token.chain_id) to w.address
}
```

### `client.webhooks` (JWT)

`list(params?)` · `create({ name, callback_url, topic })` → `WebhookWithSecret` (secret shown once) · `get(id)` · `update(id, params)` · `enable(id)` · `disable(id)` · `rotateSecret(id)` → `WebhookWithSecret` · `resetCircuit(id)` · `eventCallbacks(id, params?)` → `PaginatedResponse<EventCallback>` · `delete(id)`.

### `client.disputes` (JWT)

Account-level dispute list — every dispute (open **and** closed) across the caller's payments, each with its parent `payment` embedded. Complements `payments.disputes(id)` (one payment's history); unlike the `disputed` filter on `payments.list` (current-state), it still surfaces closed disputes.

`list(params?)` → `PaginatedResponse<Dispute>` — `params`: `{ status?: 'open' | 'closed', sort?, page?, per_page? }`.

### `client.analytics` (merchant, JWT + account)

Merchant sales analytics over the account's **own** payments as payee. Account-only: every method needs a JWT with a non-null account — `401` without a token, `403` for an account-less (buyer) session. All three take the same optional `AnalyticsFilters`: `{ mode?, status?, token?, chain_id?, from?, to? }` (`from`/`to` are ISO-8601; `token` + `chain_id` together scope monetary volume to a single token, so sums never mix decimals).

- `summary(filters?)` → `AnalyticsSummary` — `{ orders, disputed, refund_rate, dispute_rate, by_status, volume }`, where `volume` is one `AnalyticsVolume` per `(token, chain)` with base-unit `gross` (authorized), `settled` (net of refunds), `escrowed` (still held), and gross `captured`/`refunded` strings from the confirmed transactions.
- `timeseries(filters?, { interval? })` → `AnalyticsBucket[]` — order count per bucket (oldest first); `interval` is `'day'` (default) | `'week'` | `'month'`. `volume` is a base-unit string only when both `token` and `chain_id` are filtered, else `null`.
- `breakdown(filters, { by })` → `AnalyticsRow[]` — aggregate by `by`: `'token'` | `'chain'` | `'mode'` | `'status'`. `token`/`chain` rows carry `volume`; `mode`/`status` rows are counts only.

```ts
const { token } = await client.auth.login(privateKeyHex, 'api.rail0.xyz')
client.setAuthToken(token)
const kpis  = await client.analytics.summary({ mode: 'charge' })
const daily = await client.analytics.timeseries({}, { interval: 'day' })
const byTok = await client.analytics.breakdown(undefined, { by: 'token' })
```

### `client.chains` / `client.tokens` / `client.health`

`chains.list(params?)` → `Blockchain[]` (filter by `{ network_type, symbol }`) · `tokens.list(chainId?, symbol?)` → `Token[]` · `health.get()` → `Health`.

### `client.auth`

`getNonce()` · `verify(message, signature)` → `AuthResponse` · `login(privateKeyHex, domain, chainId?)` → `AuthResponse` (full SIWE flow; `chainId` defaults to 1 — override to match a gateway whose `SIWE_CHAIN_ID` differs).

### Logging

Pass any `(entry: LogEntry) => void` as `logger`, or the built-in `debugLogger`:

```typescript
import { debugLogger } from '@rail0/sdk'
const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz', logger: debugLogger })
// [rail0] POST 202 https://.../payments/0x.../authorize 87ms
```

## Error handling

Every 4xx / 5xx throws a `Rail0ApiError` carrying the gateway's code/title/detail
triple, plus `.status` (HTTP code) and — on `429` — `.retryAfter`:

```typescript
import { Rail0ApiError } from '@rail0/sdk'

try {
  await client.payments.capture(id, { signed_transaction })
} catch (err) {
  if (err instanceof Rail0ApiError) {
    console.error(err.error)  // branch on this: 'insufficient_token_balance'
    console.error(err.title)  // short label: 'Not enough balance'
    console.error(err.detail) // a sentence you can show a user verbatim
    if (err.status === 429 && err.retryAfter) await sleep(err.retryAfter * 1000)
  }
}
```

**`.error` is the only field to branch on** — the specific condition, read from the
gateway's `code` and falling back to the older `error` sub-code, then to the wider
`status` family, so an older gateway still yields the most specific value it sent.

`.title` and `.detail` come from the gateway's error catalogue, so the same condition
always reads the same way whichever endpoint surfaced it; `.detail` is written to be
shown to a user as-is and is also the thrown error's `.message`.

The codes span four families, and the last two are the ones most requests actually
hit — neither is raised by RAIL0 itself:

| Family | Examples |
| --- | --- |
| Request & state guards | `not_capturable`, `amount_exceeds_refundable`, `not_the_payee` |
| RAIL0 custom errors | `not_payee`, `already_captured`, `refund_expired` |
| Token reverts | `insufficient_token_balance`, `invalid_token_signature`, `authorization_already_used` |
| Broadcast rejections | `insufficient_gas_funds`, `nonce_too_low`, `replacement_underpriced` |

A **failed transaction** carries the same triple as `error_code`, `error_title` and
`error_detail`, whether it reverted on-chain or was refused before broadcast.

`.retryAfter` is the number of seconds parsed from the `Retry-After` response header
on a `429` (the gateway's rate limiter advertises its window), or `undefined`. There is
no automatic retry of `429`s — back off using this value.

`err.hint` (or `describeError(code)`) is this SDK's own local advice, a *supplement* to
`.detail` rather than a replacement — present only for codes worth adding a next step
to, `undefined` otherwise.

## Development

```bash
pnpm test
pnpm typecheck

# Regenerate types + resources from the gateway's OpenAPI schema:
#   default source is ../rail0-gateway/docs/openapi.json
#   override with RAIL0_SCHEMA_PATH=/abs/path/openapi.json  (or RAIL0_SCHEMA_URL)
pnpm generate
```

## Project structure

```text
gen/
  generate.ts     regenerates src/api.ts + resources from the gateway OpenAPI

src/
  core/
    error.ts      Rail0ApiError
    http.ts       HttpClient (fetch, timeout, retry, logging, getPaginated)
  resources/
    types.ts      gateway-vocabulary types (Payment, Dispute, Webhook, …)
    payments.ts   PaymentsResource (lifecycle + disputes)
    disputes.ts   DisputesResource (account-level list)
    wallets.ts    WalletsResource  (CRUD, balances)
    payment_methods.ts  PaymentMethodsResource (public discovery)
    webhooks.ts   WebhooksResource
    analytics.ts  AnalyticsResource (merchant sales rollups)
    chains.ts     ChainsResource
    tokens.ts     TokensResource
    health.ts     HealthResource
    auth.ts       AuthResource (SIWE)
  signing.ts      EIP-3009 / EIP-1559 signing helpers
  client.ts       Rail0Client — assembles the resources
  index.ts        public re-exports
```

## License

[MIT](LICENSE)
