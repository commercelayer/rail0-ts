# @rail0/sdk

TypeScript SDK for the [RAIL0](https://github.com/commercelayer/rail0) stablecoin payment API.

RAIL0 is an immutable smart contract that brings the authorize → capture → refund lifecycle of card networks to stablecoin payments — no intermediaries, no protocol fees, no permission required. This SDK wraps the REST API that sits in front of the contract, giving you fully-typed access to every operation from any TypeScript or JavaScript environment.

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
import { Rail0Client } from '@rail0/sdk'

const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })

// Step 1 — discover payment methods
const methods = await client.merchants.paymentMethods(1)
const usdc = methods.find(m => m.tokenSymbol === 'USDC')!

// Step 2 — create payment intent
const resp = await client.payments.createPayment({
  payment: {
    payer: '0xBuyer...',
    payee: usdc.walletAddress,
    token: usdc.tokenAddress,
  },
  amount: '50000000',       // 50 USDC (6 decimals)
  chainId: usdc.chainId,
  mode: 'authorize',
})

// Step 3 — payer signs EIP-3009 payload off-chain (use viem, ethers, etc.)
// const sig = await wallet.signTypedData(resp.signingPayload)

// Step 4 — submit payer signature
await client.payments.sign(resp.paymentId, { v, r, s })

// Step 5 — payee prepares the unsigned authorize tx
const tx = await client.payments.authorize(resp.paymentId)
// sign tx.unsignedTransaction with payee's key (EIP-1559)

// Step 6 — broadcast signed authorize tx
await client.payments.submitAuthorize(resp.paymentId, { signedTransaction: signedBytes })

// Step 7 — payee captures the funds
const captureTx = await client.payments.prepareCapture(resp.paymentId, { amount: '50000000' })
await client.payments.submitCapture(resp.paymentId, { signedTransaction: sign(captureTx) })
```

## Payment lifecycle

```text
                            authorizationExpiry       refundExpiry
                                   │                       │
  ─────────────────────────────────┼───────────────────────┼──────▶ time
   create → sign → authorize       │   capture / void       │   approve+refund
                                    │   release              │
```

| Operation | Caller | What it does |
|-----------|--------|--------------|
| `authorize` + `submitAuthorize` | payee | Prepare + broadcast the authorize tx; funds move to escrow |
| `charge` | payee | Server-side one-shot: authorize + capture with no escrow window |
| `prepareCapture` + `submitCapture` | payee | Moves escrowed funds to the merchant |
| `prepareVoid` + `submitVoid` | payee | Cancels the hold, returns funds to the payer |
| `prepareRelease` + `submitRelease` | anyone | Reclaims escrow after `authorizationExpiry` |
| `prepareApprove` + `submitApprove` | payee | ERC-20 `approve()` required before a refund |
| `prepareRefund` + `submitRefund` | payee | Returns captured funds to the payer |

## API reference

### `new Rail0Client(options)`

```typescript
const client = new Rail0Client({
  baseUrl:    'https://api.rail0.xyz',
  headers:    { Authorization: 'Bearer ...' }, // optional
  timeout:    30_000,                          // ms, default 30 000
  maxRetries: 3,                               // default 0 (no retry)
  retryDelay: 200,                             // ms base delay, doubles each attempt
  logger:     debugLogger,                     // optional — see Logging
})
```

---

### Logging

Pass any `(entry: LogEntry) => void` as `logger` to receive structured log entries.

```typescript
import { debugLogger } from '@rail0/sdk'

const client = new Rail0Client({
  baseUrl: 'https://api.rail0.xyz',
  logger: debugLogger,
})
```

Output:
```text
[rail0] POST 200 https://.../payments 87ms
[rail0] ERROR PUT https://.../payments/0x.../sign 30001ms ! AbortError: The operation was aborted
```

To integrate with pino, winston, or any structured logger:

```typescript
import type { LogEntry } from '@rail0/sdk'

const client = new Rail0Client({
  baseUrl: 'https://api.rail0.xyz',
  logger: (entry: LogEntry) => {
    if (entry.error) {
      log.error(entry, 'rail0 request failed')
    } else {
      log.debug(entry, 'rail0 request')
    }
  },
})
```

---

### `client.merchants`

#### `.paymentMethods(merchantId)` → `Promise<PaymentMethod[]>`

Returns the active payment methods (chain + token + wallet) for a merchant.

```typescript
const methods = await client.merchants.paymentMethods(1)
// methods[0].chainId, .tokenAddress, .walletAddress, .tokenSymbol, .chainSlug
```

---

### `client.payments`

All methods return a `Promise<T>`. Errors throw `Rail0ApiError`.

#### `.get(paymentId)` → `Promise<PaymentResponse>`

Fetches the current payment state (DB status + live on-chain escrow balances).

```typescript
const state = await client.payments.get(paymentId)
// state.status, state.onChain.capturableAmount, state.onChain.refundableAmount
```

#### `.createPayment(params)` → `Promise<CreatePaymentResponse>`

Creates a payment intent. Returns `signingPayload` for the payer to sign, plus `rail0Contract`.

#### `.sign(paymentId, params)` → `Promise<PayerSignatureResponse>`

Submits the payer's EIP-712 signature (v, r, s).

#### `.authorize(paymentId)` → `Promise<PrepareTransactionResponse>`

Prepares the unsigned `authorize()` transaction. Called by the payee. Sign `unsignedTransaction` with the payee's key and pass to `submitAuthorize`.

#### `.submitAuthorize(paymentId, params)` → `Promise<AuthorizePaymentResponse>`

Broadcasts the signed authorize transaction. Funds are moved to escrow.

```typescript
const tx = await client.payments.authorize(paymentId)
const res = await client.payments.submitAuthorize(paymentId, { signedTransaction: signedBytes })
// res.transactionHash, res.capturableAmount
```

#### `.charge(paymentId)` → `Promise<ChargePaymentResponse>`

Server-side one-shot: authorize + capture in a single transaction. No `submit` step. Called by the payee.

#### `.prepareCapture(paymentId, params)` / `.submitCapture(paymentId, params)`

Build and broadcast the capture transaction. Partial captures are supported.

```typescript
const tx = await client.payments.prepareCapture(paymentId, { amount: '50000000' })
const res = await client.payments.submitCapture(paymentId, { signedTransaction: signed })
// res.capturedAmount, res.capturableAmount, res.refundableAmount
```

#### `.prepareVoid(paymentId)` / `.submitVoid(paymentId, params)`

Void the authorization — releases all escrowed funds to the payer.

#### `.prepareRelease(paymentId, params?)` / `.submitRelease(paymentId, params)`

Release escrowed funds after `authorizationExpiry`. Pass `{ callerAddress }` to build the tx for the buyer (payer).

```typescript
const tx = await client.payments.prepareRelease(paymentId, { callerAddress: buyerAddr })
await client.payments.submitRelease(paymentId, { signedTransaction: buyerSigned })
```

#### `.prepareApprove(paymentId, params)` / `.submitApprove(paymentId, params)`

ERC-20 `approve()` before a refund. Include `amount` in `submitApprove` so the API records it.

```typescript
const tx = await client.payments.prepareApprove(paymentId, { amount: '50000000' })
await client.payments.submitApprove(paymentId, { signedTransaction: signed, amount: '50000000' })
```

#### `.prepareRefund(paymentId, params)` / `.submitRefund(paymentId, params)`

Build and broadcast the refund transaction. Partial refunds are supported.

---

## Error handling

Every 4xx / 5xx response is thrown as a `Rail0ApiError`:

```typescript
import { Rail0ApiError } from '@rail0/sdk'

try {
  await client.payments.submitCapture(paymentId, params)
} catch (err) {
  if (err instanceof Rail0ApiError) {
    console.error(err.status)  // HTTP status code, e.g. 422
    console.error(err.error)   // contract error name, e.g. "AuthorizationExpired"
    console.error(err.message) // human-readable description
  }
}
```

Common error codes:

| Error | Cause |
|-------|-------|
| `PaymentAlreadyExists` | `authorize` / `charge` called twice with the same `paymentId` |
| `PaymentNotFound` | `paymentId` does not exist |
| `AuthorizationExpired` | `authorizationExpiry` is in the past (capture) |
| `AuthorizationNotExpired` | `authorizationExpiry` has not passed yet (release) |
| `RefundExpired` | `refundExpiry` is in the past |
| `InvalidAmount` | `amount` is 0 |
| `NotPayee` | caller is not `payment.payee` |

---

## Development

```bash
pnpm test
pnpm typecheck

# Regenerate src/api.ts after an API change:
# 1. Update the schema in rail0-api (sibling repo),
#    or set RAIL0_SCHEMA_PATH to point to a local file.
# 2. Regenerate:
pnpm generate
```

## Project structure

```text
gen/              Generation pipeline (schema from rail0-api)
  generate.ts     regenerates src/api.ts from the schema

src/
  core/
    error.ts      Rail0ApiError
    http.ts       HttpClient (fetch, timeout, retry, logging)

  resources/
    types.ts      type aliases and hand-written types
    merchants.ts  MerchantsResource
    payments.ts   PaymentsResource

  client.ts       Rail0Client — assembles the resources
  index.ts        public re-exports
```

---

## License

[MIT](LICENSE)
