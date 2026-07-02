# @rail0/sdk

TypeScript SDK for the [RAIL0](https://github.com/commercelayer/rail0) stablecoin payment API.

RAIL0 brings the authorize → capture → refund lifecycle of card networks to stablecoin payments — no intermediaries, no protocol fees. This SDK wraps the REST API in front of the contract with fully-typed access to every operation, plus client-side EIP-3009 / EIP-1559 signing helpers (via `@noble` — no ethers/viem dependency). It mirrors the [rail0-go](https://github.com/commercelayer/rail0-go) SDK surface.

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
import { Rail0Client, signPayment, signTransaction } from '@rail0/sdk'

const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })

// Pack a { v, r, s } signature into the 65-byte hex the gateway expects.
const packSig = (s: { v: number; r: string; s: string }) =>
  `${s.r}${s.s.slice(2)}${s.v.toString(16).padStart(2, '0')}`

// 1. Buyer creates the payment (mode: authorize → escrow).
const payment = await client.payments.create({
  chain_id: 8453,
  mode: 'authorize',
  amount: '50000000', // 50 USDC (6 decimals)
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payer: '0xBuyer...',
  payee: '0xMerchant...',
})

// 2. Buyer signs the EIP-3009 payload the gateway returned, then stores it.
const sig = signPayment(BUYER_KEY, payment) // { v, r, s }
await client.payments.sign(payment.rail0_id, { signature: packSig(sig) })

// 3. Payee authorizes: prepare → sign the EIP-1559 tx → submit (funds → escrow).
const authPrep = await client.payments.authorizePrepare(payment.rail0_id)
await client.payments.authorize(payment.rail0_id, {
  signed_transaction: signTransaction(authPrep.unsigned_transaction!, PAYEE_KEY),
})

// 4. Payee captures once the order is fulfilled.
const capPrep = await client.payments.capturePrepare(payment.rail0_id, '50000000')
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

Payment status values: `unsigned`, `signed`, `authorized`, `charged`, `captured`, `partially_captured`, `voided`, `released`, `refunded`, `partially_refunded`.

| Operation | Caller | What it does |
|-----------|--------|--------------|
| `authorizePrepare` + `authorize` | payee | Broadcast the authorize tx; funds move to escrow |
| `chargePrepare` + `charge` | payee | One-shot authorize + capture, no escrow window |
| `capturePrepare` + `capture` | payee | Move escrowed funds to the merchant (partial supported) |
| `voidPrepare` + `void` | payee | Cancel the hold, return funds to the payer |
| `releasePrepare` + `release` | anyone | Reclaim escrow after the authorization expiry |
| `refundPrepare` + `refund` | payee | Two-phase EIP-3009 `receiveWithAuthorization` refund |
| `disputePrepare` + `dispute` | payer | Open a dispute (signal-only) |
| `closeDisputePrepare` + `closeDispute` | payer | Close an open dispute |

## Signing helpers

All client-side, over `@noble` (no ethers/viem).

| Helper | Use |
|--------|-----|
| `signPayment(key, paymentDetail)` | Payer signs the EIP-3009 payload from `create()` (authorize or charge) |
| `signRefund(key, transaction)` | Payee signs the refund payload from `refundPrepare` phase-1 |
| `signTransaction(unsignedJson, key)` | Sign an unsigned EIP-1559 tx from any prepare step → raw hex for submit |
| `signAuthorize` / `signCharge` | Lower-level EIP-3009 signers from explicit params |
| `signTransferWithAuthorization` / `signReceiveWithAuthorization` | Raw EIP-3009 transfer / receive signers |

## API reference

### `new Rail0Client(options)`

```typescript
const client = new Rail0Client({
  baseUrl:    'https://api.rail0.xyz',
  headers:    { Authorization: 'Bearer ...' }, // optional (required for authed endpoints)
  timeout:    30_000,                          // ms, default 30 000
  maxRetries: 3,                               // default 0 (network errors only)
  retryDelay: 200,                             // ms base, doubles each attempt
  logger:     debugLogger,                     // optional — see Logging
})
```

Resources: `client.payments`, `client.wallets`, `client.webhooks`, `client.chains`, `client.tokens`, `client.health`, `client.auth`.

### `client.payments`

`create(params)` → `PaymentDetail` · `get(id)` → `PaymentDetail` (status + live `capturable_amount`/`refundable_amount` + `transactions`) · `list(params?)` → `PaginatedResponse<Payment>` (JWT) · `transactions(id, params?)` → `PaginatedResponse<Transaction>` · `sign(id, { signature })` → `PaymentDetail` · `disputes(id)` → `Dispute[]`.

Prepare/submit pairs (each prepare → `Transaction`, each submit → `Transaction`):
`authorizePrepare`/`authorize`, `chargePrepare`/`charge`, `capturePrepare(id, amount)`/`capture`, `voidPrepare`/`void`, `releasePrepare(id, from?)`/`release`, `refundPrepare(id, body)`/`refund`, `disputePrepare(id, reason?)`/`dispute`, `closeDisputePrepare(id, reason?)`/`closeDispute`. A generic `prepare(id, op, body?)` / `submit(id, op, params)` is also available.

**Refund** is two-phase: `refundPrepare(id, { amount })` returns a `Transaction` carrying a `signing_payload`; sign it with `signRefund`, then `refundPrepare(id, { amount, signature })` returns the unsigned on-chain tx to sign + `refund()`.

### `client.wallets` (scoped by account)

`list(accountId, params?)` → `PaginatedResponse<WalletWithTokens>` · `get(accountId, idOrAddress)` → `Wallet` · `create(accountId, { address, label? })` → `Wallet` · `update(accountId, id, { label?, active? })` → `Wallet` · `delete(accountId, id)` → `void` · `balances(accountId, id, params?)` → `WalletBalances` · `paymentMethods(accountId, params?)` → `PaymentMethod[]` (client-side flatten of active wallets × tokens).

### `client.webhooks` (JWT)

`list(params?)` · `create({ name, callback_url, topic })` → `WebhookWithSecret` (secret shown once) · `get(id)` · `update(id, params)` · `enable(id)` · `disable(id)` · `rotateSecret(id)` → `WebhookWithSecret` · `resetCircuit(id)` · `eventCallbacks(id, params?)` → `PaginatedResponse<EventCallback>` · `delete(id)`.

### `client.chains` / `client.tokens` / `client.health`

`chains.list()` → `Blockchain[]` · `tokens.list(chainId?)` → `Token[]` · `health.get()` → `Health`.

### `client.auth`

`getNonce()` · `verify(message, signature)` → `AuthResponse` · `login(privateKeyHex, domain)` → `AuthResponse` (full SIWE flow).

### Logging

Pass any `(entry: LogEntry) => void` as `logger`, or the built-in `debugLogger`:

```typescript
import { debugLogger } from '@rail0/sdk'
const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz', logger: debugLogger })
// [rail0] POST 202 https://.../payments/0x.../authorize 87ms
```

## Error handling

Every 4xx / 5xx throws a `Rail0ApiError` with `.status`, `.error` (machine code), and `.message`:

```typescript
import { Rail0ApiError } from '@rail0/sdk'

try {
  await client.payments.capture(id, { signed_transaction })
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(err.status, err.error, err.message)
}
```

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
    wallets.ts    WalletsResource  (CRUD, balances, paymentMethods)
    webhooks.ts   WebhooksResource
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
