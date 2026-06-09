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

const client = new Rail0Client({
  baseUrl: 'https://api.rail0.xyz',
  headers: { Authorization: 'Bearer <jwt>' },
})

// Step 1 — list wallets for an account and pick one
const wallets = await client.accounts.wallets(accountId)
const wallet = wallets.data[0]

// Step 2 — pick a token accepted by that wallet
const tokens = await client.wallets.tokens(wallet.id)
const usdc = tokens.data.find(t => t.symbol === 'USDC')!

// Step 3 — create payment intent
const resp = await client.payments.create({
  chain_id: usdc.blockchain.chain_id,
  mode:     'authorize',
  amount:   '50000000',       // 50 USDC (6 decimals)
  payer:    '0xBuyer...',
  payee:    wallet.address,
  token:    usdc.address,
})

// Step 4 — payer signs EIP-3009 payload off-chain (use viem, ethers, etc.)
// const sig = await wallet.signTypedData(resp.signing_payload)

// Step 5 — submit payer signature
await client.payments.sign(resp.rail0_id, { signature: sig.toHex() })

// Step 6 — payee fetches the unsigned authorize tx (prepare step)
const tx = await client.payments.authorizePrepare(resp.rail0_id)
// sign tx.unsigned_transaction with payee's key (EIP-1559)

// Step 7 — submit the signed authorize tx (HTTP 202, async)
await client.payments.authorize(resp.rail0_id, { signedTransaction: signedBytes })

// Step 8 — poll until status leaves "submitting"
let state = await client.payments.get(resp.rail0_id)
while (state.status === 'submitting') {
  await new Promise(r => setTimeout(r, 2_000))
  state = await client.payments.get(resp.rail0_id)
}

// Step 9 — payee captures the funds
const captureTx = await client.payments.capturePrepare(resp.rail0_id, { amount: '50000000' })
await client.payments.capture(resp.rail0_id, { signedTransaction: sign(captureTx) })
```

## Payment lifecycle

Each operation follows the same two-step pattern:

1. **Prepare step** — `POST /payments/:id/operation/prepare` — returns an unsigned EIP-1559 transaction. Sign it off-chain with the payee's key.
2. **Submit step** — `POST /payments/:id/operation` with `{ signedTransaction }` — broadcasts the signed tx (HTTP 202, async). Poll `get()` until status leaves `"submitting"`.

```text
                            authorizationExpiry       refundExpiry
                                   │                       │
  ─────────────────────────────────┼───────────────────────┼──────▶ time
   create → sign → authorize       │   capture / void       │   refund (EIP-3009)
                                    │   release              │
```

Payment status values: `submitting`, `submitted`, `partially_captured`, `partially_refunded`, `failed`, and the standard `authorized`, `captured`, `voided`, `released`, `refunded`.

| Operation | Caller | What it does |
|-----------|--------|--------------|
| `authorizePrepare` + `authorize` | payee | Prepare + broadcast the authorize tx; funds move to escrow |
| `chargePrepare` + `charge` | payee | One-shot: authorize + capture with no escrow window |
| `capturePrepare` + `capture` | payee | Moves escrowed funds to the merchant |
| `voidPrepare` + `void` | payee | Cancels the hold, returns funds to the payer |
| `releasePrepare` + `release` | anyone | Reclaims escrow after `authorizationExpiry` |
| `refundPrepare` + `refund` | payee | EIP-3009 `receiveWithAuthorization` refund (no ERC-20 approve needed) |

## Contract addresses (v9)

| Network | Chain ID | Contract |
|---------|----------|----------|
| Arc Testnet | 5042002 | `0x0e393A626EfC45EBd030EBB997CDa207013C4364` |
| Celo Sepolia | 44787 | `0x7337ce441e831ef2904b7B2f33507d655a4381d0` |

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

### `client.accounts`

#### `.wallets(accountId, params?)` → `Promise<PaginatedResponse<Wallet>>`

List wallets registered to an account.

```typescript
const result = await client.accounts.wallets(accountId, { active: true })
// result.data[0].id, .address, .label, .active, .account_id
```

#### `.wallet(accountId, walletId)` → `Promise<Wallet>`

Fetch a single wallet.

```typescript
const wallet = await client.accounts.wallet(accountId, walletId)
```

#### `.createWallet(accountId, params)` → `Promise<Wallet>`

Register a new EVM wallet address. Requires authentication.

```typescript
const wallet = await client.accounts.createWallet(accountId, {
  address: '0xABC...',
  label:   'Treasury',
})
```

#### `.updateWallet(accountId, walletId, params)` → `Promise<Wallet>`

Update label or active status. Requires authentication.

```typescript
const wallet = await client.accounts.updateWallet(accountId, walletId, { active: false })
```

#### `.deleteWallet(accountId, walletId)` → `Promise<void>`

Remove a wallet from an account. Requires authentication.

```typescript
await client.accounts.deleteWallet(accountId, walletId)
```

---

### `client.wallets`

#### `.tokens(walletId, params?)` → `Promise<PaginatedResponse<Token>>`

List the tokens accepted by a wallet. Each token includes a nested `blockchain` object.

```typescript
const result = await client.wallets.tokens(walletId, { symbol: 'USDC' })
// result.data[0].id, .symbol, .address, .decimals, .active
// result.data[0].blockchain.chain_id, .name, .slug, .rpc_url
```

---

### `client.tokens`

#### `.list(params?)` → `Promise<CatalogToken[]>`

List all tokens from the flat catalog (no entity IDs, no nested blockchain).

```typescript
const tokens = await client.tokens.list({ chain_slug: 'arc-testnet' })
// tokens[0].chain_id, .chain_slug, .symbol, .address, .decimals
```

---

### `client.chains`

#### `.list()` → `Promise<Blockchain[]>`

List all supported blockchains.

```typescript
const chains = await client.chains.list()
// chains[0].chain_id, .name, .slug, .rpc_url, .explorer_url
```

---

### `client.payments`

All methods return a `Promise<T>`. Errors throw `Rail0ApiError`.

#### `.list()` → `Promise<PaymentResponse[]>`

Lists payments for the authenticated account. Requires a bearer token in the client headers.

#### `.get(paymentId)` → `Promise<PaymentResponse>`

Fetches the current payment state (DB status + live on-chain escrow balances).

```typescript
const state = await client.payments.get(paymentId)
// state.status, state.on_chain.capturable_amount, state.on_chain.refundable_amount
```

#### `.create(params)` → `Promise<CreatePaymentResponse>`

Creates a payment intent. Returns `signing_payload` for the payer to sign, plus `rail0_contract`.

#### `.sign(paymentId, params)` → `Promise<PayerSignatureResponse>`

Submits the payer's EIP-712 signature as a single 65-byte hex string (`{ signature: "0x..." }`).

#### `.authorizePrepare(paymentId)` → `Promise<PrepareTransactionResponse>`

Prepares the unsigned `authorize()` transaction. Called by the payee. Sign `unsigned_transaction` with the payee's key and pass to `authorize()`.

#### `.authorize(paymentId, params)` → `Promise<...>`

Broadcasts the signed authorize transaction (HTTP 202, async). Poll `get()` until status leaves `"submitting"`.

```typescript
const tx = await client.payments.authorizePrepare(paymentId)
// sign tx.unsigned_transaction with payee's key
await client.payments.authorize(paymentId, { signedTransaction: signedBytes })
```

#### `.chargePrepare(paymentId)` → `Promise<PrepareTransactionResponse>`

Prepares the unsigned charge transaction (one-shot authorize + capture, no escrow window).

#### `.charge(paymentId, params)` → `Promise<...>`

Broadcasts the signed charge transaction (HTTP 202, async).

#### `.capturePrepare(paymentId, params)` → `Promise<PrepareTransactionResponse>`

Build the unsigned capture transaction. Partial captures are supported.

```typescript
const tx = await client.payments.capturePrepare(paymentId, { amount: '50000000' })
await client.payments.capture(paymentId, { signedTransaction: sign(tx) })
```

#### `.voidPrepare(paymentId)` → `Promise<PrepareTransactionResponse>`

Build the unsigned void transaction — releases all escrowed funds to the payer.

#### `.releasePrepare(paymentId, params?)` → `Promise<PrepareTransactionResponse>`

Build the unsigned release transaction for reclaiming escrow after `authorizationExpiry`. Pass `{ callerAddress }` to build the tx for the buyer (payer).

#### `.refundPrepare(paymentId, params)` → `Promise<PrepareTransactionResponse>`

Two-phase EIP-3009 `receiveWithAuthorization` refund (no ERC-20 approve step required).

**Phase 1** — pass `{ amount }` only — returns the EIP-3009 signing payload. Sign off-chain to obtain `v`, `r`, `s`.

**Phase 2** — pass `{ amount, v, r, s }` — returns the unsigned on-chain refund transaction.

```typescript
// Phase 1 — get EIP-3009 signing payload
const sigPayload = await client.payments.refundPrepare(paymentId, { amount: '50000000' })
// sign sigPayload.signing_payload off-chain → v, r, s

// Phase 2 — get unsigned on-chain tx
const tx = await client.payments.refundPrepare(paymentId, { amount: '50000000', v, r, s })
// sign tx.unsigned_transaction with payee's key
await client.payments.refund(paymentId, { signedTransaction: signedBytes })
```

#### `.refund(paymentId, params)` → `Promise<...>`

Broadcasts the signed refund transaction (HTTP 202, async).

---

## Error handling

Every 4xx / 5xx response is thrown as a `Rail0ApiError`:

```typescript
import { Rail0ApiError } from '@rail0/sdk'

try {
  await client.payments.authorize(paymentId, params)
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
    accounts.ts   AccountsResource  (wallet CRUD)
    wallets.ts    WalletsResource   (wallet tokens)
    tokens.ts     TokensResource    (flat catalog)
    payments.ts   PaymentsResource

  client.ts       Rail0Client — assembles the resources
  index.ts        public re-exports
```

---

## License

[MIT](LICENSE)
