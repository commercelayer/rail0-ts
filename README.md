# @commercelayer/rail0-sdk

TypeScript SDK for the [RAIL0](https://github.com/commercelayer/rail0) stablecoin payment gateway.

RAIL0 brings the authorize → capture → refund lifecycle of card networks to stablecoin payments — no intermediaries, no protocol fees. This SDK is a fully-typed REST client for the RAIL0 gateway in front of the contract, with access to every operation, plus client-side EIP-3009 / EIP-1559 signing helpers (via `@noble` — no ethers/viem dependency). It mirrors the [rail0-go](https://github.com/commercelayer/rail0-go) SDK surface.

## Requirements

- Node.js ≥ 22
- TypeScript ≥ 6 (for TypeScript projects)

## Installation

```bash
npm install @commercelayer/rail0-sdk
# or
pnpm add @commercelayer/rail0-sdk
```

## Quick start

Every `/payments` route requires a SIWE session, and each role acts from its own: the
**buyer** creates and signs the payment (the gateway answers `403 payer_must_be_caller`
unless `payer` is the signed-in address), the **merchant** (payee) authorizes and
captures. So a flow is two clients, each logged in with its own key — `auth.login`
installs the session on the client it runs on.

```typescript
import {
  addressFromPrivateKey,
  packSignature,
  Rail0Client,
  signPayment,
  signTransaction,
} from '@commercelayer/rail0-sdk'

const baseUrl = 'https://api.rail0.xyz'
const buyer = new Rail0Client({ baseUrl })
const merchant = new Rail0Client({ baseUrl })
await buyer.auth.login(BUYER_KEY, 'api.rail0.xyz') // an account-less (buyer) session
await merchant.auth.login(MERCHANT_KEY, 'api.rail0.xyz') // the payee's account session

// 1. Buyer creates the payment (mode: authorize → escrow). payer MUST be the session address.
const payment = await buyer.payments.create({
  chain_id: 8453,
  mode: 'authorize',
  amount: '50.00', // human decimal — the gateway converts to base units
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payer: addressFromPrivateKey(BUYER_KEY),
  payee: addressFromPrivateKey(MERCHANT_KEY),
})

// 2. Buyer signs the EIP-3009 payload the gateway returned, then stores it. The third
//    argument is what the payload is CHECKED against before the key signs it (see
//    "Signing helpers"): the payment's chain, token and RAIL0 contract, and the amount.
const sig = signPayment(BUYER_KEY, payment, { payment, amount: '50.00' }) // { v, r, s }
await buyer.payments.sign(payment.rail0_id, { signature: packSignature(sig) })

// 3. Merchant authorizes: prepare → sign the EIP-1559 tx → submit (funds → escrow).
//    The third argument is what the gateway's transaction is CHECKED against before
//    the key signs it (see "Signing helpers"); `payment` is the record read from the gateway.
const authPrep = await merchant.payments.authorizePrepare(payment.rail0_id)
await merchant.payments.authorize(payment.rail0_id, {
  signed_transaction: signTransaction(authPrep.unsigned_transaction!, MERCHANT_KEY, {
    payment,
    operation: 'authorize',
  }),
})

// 4. Merchant captures once the order is fulfilled.
const capPrep = await merchant.payments.capturePrepare(payment.rail0_id, '50.00')
await merchant.payments.capture(payment.rail0_id, {
  signed_transaction: signTransaction(capPrep.unsigned_transaction!, MERCHANT_KEY, {
    payment,
    operation: 'capture',
    amount: '50.00',
  }),
})

// Inspect live state at any point (either participant can read it).
const detail = await merchant.payments.get(payment.rail0_id)
console.log(detail.status, detail.capturable_amount, detail.refundable_amount)
```

See [`examples/`](examples) for authorize+capture, charge, refund, dispute, and webhooks.

## Payment lifecycle

Each on-chain operation is a two-step **prepare → submit**:

1. **Prepare** — `POST /payments/:id/:op/prepare` — returns a `Transaction` whose `unsigned_transaction` you sign (EIP-1559) with `signTransaction`, passing the payment, the operation and (capture/refund) the amount so the transaction is verified before it is signed.
2. **Submit** — `POST /payments/:id/:op` with `{ signed_transaction }` — broadcasts it (HTTP 202, async). Poll `get()` until the status settles.

When a wallet like **MetaMask** signs and broadcasts in one step (so you never hold the raw signed tx), report the resulting hash instead: **submit-by-hash** — `POST /payments/:id/:op/submitted` with `{ transaction_hash }` via `submitByHash(id, op, { transaction_hash })` (payee-only for the merchant ops; `release` accepts either participant). A **buyer** does the same for its own operations with `disputeSubmitByHash(id, { transaction_hash })` and `closeDisputeSubmitByHash(id, { transaction_hash })` (payer-only).

The `:id` accepts **either** the payment's UUID **or** its `rail0_id` (the contract's bytes32 id) — the gateway resolves both.

Payment status values: `unsigned`, `signed`, `authorized`, `charged`, `captured`, `partially_captured`, `voided`, `released`, `refunded`, `partially_refunded`, `expired`. `expired` is a never-captured authorization whose window lapsed (announced by `payments.expired`) and is **not** terminal: the escrow is still on-chain, and `release` closes it as `released`. Status changes are happy-path — a payment only leaves its state to *close*: `partially_refunded` is legacy and no longer produced (a partial refund leaves the status unchanged).

| Operation | Caller | What it does |
|-----------|--------|--------------|
| `authorizePrepare` + `authorize` | payee | Broadcast the authorize tx; funds move to escrow |
| `chargePrepare` + `charge` | payee | One-shot authorize + capture, no escrow window |
| `capturePrepare` + `capture` | payee | Move escrowed funds to the merchant (partial supported) |
| `voidPrepare` + `void` | payee | Cancel the hold, return funds to the payer — **only before any capture** (else the contract reverts `AlreadyCaptured`) |
| `releasePrepare` + `release` | payer or payee | Return the uncaptured escrow after expiry (any other sender is refused `422 release_submitter_not_a_party`). A **total** release from `authorized`/`expired` closes as `released`; a release that leaves both balances at 0 (the captured part already refunded) closes as `refunded`; otherwise the status is unchanged |
| `refundPrepare` + `refund` | payee | Two-phase EIP-3009 `receiveWithAuthorization` refund; closes as `refunded` only when **fully settled**, else status unchanged |
| `disputePrepare` + `dispute` | payer | Open a dispute (signal-only) — optional `reason` from the dispute-reason dictionary |
| `closeDisputePrepare` + `closeDispute` | payer | Close an open dispute — optional `reason` from the dispute-reason dictionary |

## Signing helpers

All client-side, over `@noble` (no ethers/viem).

| Helper | Use |
|--------|-----|
| `signSigningPayload(key, payload, { payment, amount? })` | Verify, then sign any gateway `signing_payload` (mirrors rail0-go's `SignSigningPayload`) — the one generic signer. The two-argument form signs blindly and is **deprecated** |
| `signPayment(key, paymentDetail, { payment, amount? })` | Payer signs the EIP-3009 payload from `create()` (authorize or charge) — `signSigningPayload` on `.signing_payload`. The two-argument form is **deprecated** |
| `signRefund(key, transaction, { payment, amount })` | Payee signs the refund payload from `refundPrepare` phase-1 — `signSigningPayload` on `.signing_payload`. The two-argument form is **deprecated** |
| `verifySigningPayload(payload, { payment, amount? }, signer?)` | The authorization pre-sign check on its own (for a signer that is not a local key — run it before handing the payload to a browser wallet's `eth_signTypedData_v4`) |
| `packSignature(sig)` | Turn a `{ v, r, s }` into the `0x` r‖s‖v hex every `signature` field expects |
| `signTransaction(unsignedJson, key, { payment, operation, amount? })` | Verify, then sign an unsigned EIP-1559 tx from any prepare step → raw hex for submit. The two-argument form signs blindly and is **deprecated** |
| `verifyUnsignedTransaction(unsignedJson, { payment, operation, amount? }, signer?)` | The pre-sign check on its own (for a signer that is not a local key — a KMS, a hardware wallet) |
| `signPayoutTransaction(unsignedJson, key, { payout, destination?, amount?, decimals?, maxAmount? })` | Verify, then sign a prepared payout's ERC-20 `transfer` → raw hex for `payouts.submit`. Always verified — there is no blind form (see [Payouts](#clientpayoutdestinations--clientpayouts-merchant-jwt)) |
| `verifyPayoutTransaction(unsignedJson, { payout, … }, signer?)` | The payout pre-sign check on its own (for a browser wallet, a KMS, a hardware wallet) |
| `signAuthorize` / `signCharge` | **Deprecated.** They rebuild the digest with the TransferWithAuthorization typehash, but every active deployment (v1.4.0) has the payer sign a ReceiveWithAuthorization, so the gateway answers `422 signer_mismatch`. Use `signPayment` / `signSigningPayload` with an expectation |
| `signTransferWithAuthorization` / `signReceiveWithAuthorization` | Raw EIP-3009 transfer / receive signers |
| `buildSiweMessage(params)` | Build the EIP-4361 text for a login or a wallet proof-of-ownership |
| `addressFromPrivateKey(key)` | The EIP-55 checksummed address of a private key (`checksumAddress` is the deprecated old name — it never formatted an address) |

**What the payload signers verify, and why.** An EIP-3009 authorization is a bearer
instrument the **token** honours on its own, with no RAIL0 involvement, for up to its
`value` — so a compromised or misconfigured endpoint that answered a refund prepare
with `{ from: <you>, to: <attacker>, value: <your whole balance> }` would otherwise get
exactly that signed. Given the expectation, `signSigningPayload` (and `signPayment` /
`signRefund`) checks the payload **before** the key touches it. First the typed-data
envelope: `primaryType` is `ReceiveWithAuthorization` (authorize/charge on v1.4.0+
deployments, and every refund) or `TransferWithAuthorization` (authorize/charge on
v1.1.0–v1.3.x); `types[primaryType]` is **exactly** the EIP-3009 struct — `address from,
address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce`,
same names, types and order; `types.EIP712Domain`, when present, is exactly `string
name, string version, uint256 chainId, address verifyingContract`; and `types` defines
nothing else. A local key rebuilds the digest from fixed typehashes, but a browser
wallet hashes whatever `types` says, so this is what keeps a wallet from signing a
struct whose fields were renamed or retyped under the same names. Then, in this order:
`message.from` is your key's address, `domain.chainId` is the payment's `chain_id`,
`domain.verifyingContract` is the payment's `token`, `message.to` is the payment's
`rail0_contract`, and `message.value` is **exactly** the expected base units. The
expected value is `amount` (the human decimal you typed) scaled by the payment's
`decimals` when you pass it, and the payment's own base-unit `amount` otherwise — so
**always pass `amount` for a refund** (the payment's amount is the whole payment, not
the part refunded). The first mismatch throws `Error("refusing to sign: …")` naming the
field, and nothing is signed. It fails closed: a missing payload, a payment without
`chain_id` / `token` / `rail0_contract`, unknown `decimals`, or an amount finer than the
token allows is refused rather than skipped. Build the expectation from the payment
record you already hold — no extra request:

```typescript
// Payer, right after create(): hold the gateway to the amount you sent.
const created = await buyer.payments.create({ ...req, amount: '50.00' })
const sig = signSigningPayload(BUYER_KEY, created.signing_payload, {
  payment: created, // chain_id, token, rail0_contract, decimals
  amount: '50.00',
})

// Payee, refund phase-1: the payment from get(), the refund amount you typed.
const payment = await merchant.payments.get(id)
const phase1 = await merchant.payments.refundPrepare(id, { amount: '10.00' })
const refundSig = signRefund(MERCHANT_KEY, phase1, { payment, amount: '10.00' })
```

What this does not establish: `message.to` is compared with the payment's own
`rail0_contract` (the same gateway's word), and `message.nonce` — which binds the
signature to the payment's terms on-chain — is not recomputed, since that needs the
deployment's `VERSION()`, which no payment response carries. The bounded residual is an
authorization for the right token, chain and signer, for exactly the amount you asked
for. The validity window is not compared. The SDK cannot tell which of the two
`primaryType`s a given payment needs (that is the deployment's version again), so it
accepts either and refuses anything else.

`signSigningPayload` takes the payload itself (`null`/`undefined` throws). The two
named wrappers need only the `signing_payload` field, so they accept any
`{ signing_payload }` — a whole `PaymentDetail`/`Transaction`, or just the payload
holder. An unrecognised `primaryType` **throws** rather than defaulting to the
transfer typehash: the gateway's payload is signed verbatim, never rebuilt
client-side.

**What `signTransaction` verifies, and why.** The gateway builds the EIP-1559
transaction and your key signs it, so a compromised or misconfigured endpoint could
otherwise have that key sign anything — an `approve(spender, MAX)` on the token, a
`capture` answered to a `void` prepare, a capture for more than you asked. Given the
expectation, `signTransaction` checks the transaction **before** the key touches it,
against data you already hold (no extra request): `value` is zero (every RAIL0
operation is value-0), `chain_id` is the payment's chain, `from` is your key's address,
`to` is an address equal to the payment's `rail0_contract`, the 4-byte selector is the RAIL0 function for
`operation` (the selectors are derived from the contract's function signatures and
pinned against its ABI in the test suite), the first calldata word is the payment's
`rail0_id`, and — for `capture` and `refund` — the amount word equals `amount` scaled by
the payment's `decimals`. The first mismatch throws `Error("refusing to sign: …")`
naming the field, and no signature is produced. It fails closed: a capture/refund with
no `amount`, a payment with unknown `decimals`, or a payment without `rail0_contract`
is refused rather than skipped, so read the payment with `get()` first. A missing,
empty or `null` `to` is always refused — even by the deprecated two-argument form —
because the RLP encoding of an empty recipient is a contract-creation transaction. `to` is a consistency check only — the address
comes from the same gateway — which is why the calldata binding to this payment's id
and operation is what closes a swapped transaction.
## Amounts

Amounts you **send** (`create`, `capturePrepare`, `refundPrepare`) are human
decimal strings (`'50.00'`) — the gateway converts them to base units using the
token's decimals. Amounts you **read** back (`amount`, `capturable_amount`,
`refundable_amount`, analytics volumes, the `min_amount`/`max_amount` list
filters) are base-unit integer strings (`'50000000'`).

Rendering one needs the token's `decimals`, and every `Payment` carries them —
list rows, `get(id)`, and the payment embedded in `disputes.list()` alike — so
displaying an amount needs neither a per-row `get(id)` nor a `tokens.list()` join on
`token` + `chain_id`:

```typescript
const { data } = await client.payments.list()
for (const p of data) {
  if (p.decimals != null) console.log(formatAmount(p.amount, p.decimals))
}
```

`decimals` is `null` only when the gateway cannot resolve the token (a contract it has
not loaded, a token deleted outright); fall back to `tokens.list()` on `token`
**together with** `chain_id` then — a token address identifies a token only within
one chain, and both fields are on every `Payment` too.

Convert between a human decimal and the token's base-unit integer string, with
string/BigInt math (no float rounding):

```typescript
import { toBaseUnits, formatAmount } from '@commercelayer/rail0-sdk'

toBaseUnits('1.50', 6) // → '1500000'   (USDC has 6 decimals)
formatAmount('1500000', 6) // → '1.5'   (trailing zeros trimmed)
```

`toBaseUnits` throws on fractional digits beyond `decimals` (the gateway would refuse the
amount anyway) and on a malformed amount.

A static **stablecoin registry** ships with the SDK — `stablecoins` (per chain: `chainId`
and each token's `address`, `decimals`, `eip3009`/`eip2612` support), `chainInfo(chain)`,
and `eip3009Tokens(chain)` / `eip2612Tokens(chain)`. It is a static table shipped with
the SDK, not the gateway's catalogue — that is `tokens.list()`.

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
number and would otherwise wake in lockstep). The jitter never shortens a wait below what
it is for: additive on the server's own number, equal jitter — half fixed, half random —
on a guessed one. It is **off by default** on purpose: an
automatic sleep hides back-pressure from the code that could react to it, and in a browser
it turns a rate limit into a frozen click. It also works on its own — you do not need
`maxRetries` as well, which would have made the flag a silent no-op.

A **429 is the only HTTP status this client retries**, on any method including `POST`,
because the gateway rejects it in middleware *before* the request reaches the application:
nothing ran, so nothing can run twice. That is not true of a 502 or a timeout on a
capture, where the broadcast may already be in flight — those are never retried.

`signal` cancels the request **and any retry that is waiting**, which matters precisely
because `retryOn429` can hold a promise for up to a minute.

Resources: `client.payments`, `client.accounts`, `client.wallets`, `client.paymentMethods`, `client.webhooks`, `client.disputes`, `client.analytics`, `client.chains`, `client.tokens`, `client.health`, `client.auth`.

`setAuthToken(jwt)` sets (or, with `null`/`undefined`, clears) the `Authorization: Bearer …` header on every subsequent request. A successful `auth.login()` or `auth.verify()` already calls it for you (as rail0-go's `Auth.Login`/`Verify` do), so a long-lived client is authenticated right after signing in; use `setAuthToken` to install a token you persisted, or to share one session across several clients:

```typescript
const { token } = await client.auth.login(privateKeyHex, 'api.rail0.xyz')
// client.analytics/webhooks/… are now authenticated — no setAuthToken needed.
other.setAuthToken(token) // a second client on the same session
```

### `client.payments`

`create(params, idempotencyKey?)` → `PaymentDetail` (from the **buyer's** session: `payer` must be the signed-in address, `403 payer_must_be_caller` otherwise; pass `idempotencyKey` to make the create replay-safe — the key is bound to the request, so reusing it with different terms is a `422 idempotency_key_reused`, not a silent replay of the first payment) · `get(id)` → `PaymentDetail` (status + live `capturable_amount`/`refundable_amount` + `transactions`) · `update(id, { description?, merchant_note?, reference?, reference_origin? })` → `PaymentDetail` (`PATCH /payments/:id`; participant-only — payer or payee, `404` for anyone else; allowed in any status; at least one field, `null` or `""` clears one; `description` either party, ≤255 characters; `merchant_note` is the **payee's** internal note, ≤2000 characters, never shown to the payer and not in webhooks; `reference` / `reference_origin` — the payment's identifier in the merchant's own system and which system — are the payee's to correct; the payer gets `403 not_the_payee` for those three; gateway-side only, so it moves no money and fires no webhook) · `list(params?)` → `PaginatedResponse<Payment>` (JWT; `reference` / `reference_origin` find the payments carrying a reference; `operation` narrows to payments carrying a transaction of that operation, `dispute`/`close_dispute` included; `status` takes one `PaymentStatus` or an array matching any of them) · `transactions(id, params?)` → `PaginatedResponse<Transaction>` (`status` likewise takes one `TransactionStatus` or an array) · `redrive(id, transactionId)` → `Transaction` · `sign(id, { signature })` → `PaymentDetail` · `disputes(id, params?)` → `PaginatedResponse<Dispute>`.

Prepare/submit pairs (each prepare → `Transaction`, each submit → `Transaction`):
`authorizePrepare`/`authorize`, `chargePrepare`/`charge`, `capturePrepare(id, amount)`/`capture`, `voidPrepare`/`void`, `releasePrepare(id, from?)`/`release`, `refundPrepare(id, body)`/`refund`, `disputePrepare(id, reason?)`/`dispute`, `closeDisputePrepare(id, reason?)`/`closeDispute` (optional dictionary `reason` — see [Dispute reasons](#dispute-reasons)). A generic `prepare(id, op, body?, opts?)` / `submit(id, op, params)` is also available, plus `submitByHash(id, op, { transaction_hash })` to record an already-broadcast tx by hash (MetaMask; payee-only, `release` either participant) and the payer-only `disputeSubmitByHash(id, { transaction_hash })` / `closeDisputeSubmitByHash(id, { transaction_hash })`.

**Several statuses in one call.** Pass an array to `status` and the SDK sends it
comma-separated (`status=authorized,expired`), the form the gateway documents; a single
value goes out unchanged, and an empty array is dropped. An unknown value is a compile
error here and a `400 validation_failed` naming it at the gateway.

```ts
// Everything still holding escrow, in one list instead of two fetches merged client-side:
await client.payments.list({ status: ['authorized', 'expired'] })
// A payment's transactions on their way to the chain:
await client.payments.transactions(id, { status: ['submitting', 'submitted'] })
```

**`in_flight`.** Every `Payment` — list rows included, which embed no transactions —
carries `in_flight: true` while one of its transactions is `submitting`, `submitted`, or
`pending` holding its signed transaction (`redrivable`: signed and handed over, not yet
broadcast). A `pending` row still awaiting its signature does not count, nor do
`confirmed`/`failed` rows. While it is true the balances are about to move: disable
further actions on the payment (a second operation would race the first) and keep
polling until it turns false. A bulk action can skip in-flight rows straight from
`list()`, without a `get(id)` per row.

```ts
const { data } = await client.payments.list({ status: 'authorized' })
const capturable = data.filter((p) => !p.in_flight)
```

**`scope: 'all'` (admin).** The operator's cross-account list, on the same call: every
payment on the gateway, with the same filters. It needs an admin session — anyone else
gets `403`, never a silent narrowing to their own payments. Three filters exist only
there and are ignored without it: `account_id` (payments whose payee is one of that
account's wallets), `has_error` (`true` = carrying a `last_error_code`, `false` = none)
and `expiring_within` (`authorized` payments whose hold lapses within that many
**seconds**, up to 90 days).

```ts
// Every failing payment, any account — and the holds lapsing within a day.
const failing = await client.payments.list({ scope: 'all', has_error: true })
const lapsing = await client.payments.list({ scope: 'all', expiring_within: 24 * 3600 })
```

`getTransaction(id, transactionId)` reads ONE of a payment's transactions. This is the lookup for an `action_id`: anything handed a transaction id when an operation was accepted resolves it directly, instead of fetching the payment and scanning its transactions for an id it already holds. `redrive(id, transactionId)` re-enqueues a stuck broadcast — payee-gated, or an operator session on any payment (audited as `transaction.redrive`).

**Idempotency.** Every prepare takes an optional trailing `opts: IdempotentRequest` — `{ idempotencyKey }`, sent as `Idempotency-Key`: the generic `prepare(id, op, body?, opts?)`, the typed `authorizePrepare(id, opts?)`, `chargePrepare(id, opts?)`, `capturePrepare(id, amount, opts?)`, `voidPrepare(id, opts?)`, `releasePrepare(id, from?, opts?)`, `refundPrepare(id, body, opts?)`, and `disputePrepare(id, reason?, opts?)` / `closeDisputePrepare(id, reason?, opts?)`. Without it, a retry arriving after the first transaction was signed and broadcast opens a **second** one — correct for a genuine sequential partial capture, wrong for a retry, and only the caller can tell those apart. Same key with different terms is refused `422 idempotency_key_reused`; the key is scoped to the payment.

```ts
await client.payments.capturePrepare(id, '50.00', { idempotencyKey: orderId })
```

**Refund** is two-phase: `refundPrepare(id, { amount })` returns a `Transaction` carrying a `signing_payload`; sign it with `signRefund(key, phase1, { payment, amount })` (checked against the payment and the refund amount first), then `refundPrepare(id, { amount, signature })` returns the unsigned on-chain tx to sign + `refund()`.

### `client.wallets` (scoped by account, JWT)

All wallet methods are behind SIWE — a merchant manages its **own** wallets. `list(accountId, params?)` → `PaginatedResponse<WalletWithTokens>` (`chain_id`, `token_symbol`, `default` and `token_active` narrow the nested holdings, never the wallets) · `get(accountId, idOrAddress)` → `Wallet` · `create(accountId, { address, message, signature, label? })` → `Wallet` · `update(accountId, id, { label?, active? })` → `Wallet` · `delete(accountId, id)` → `void` · `balances(accountId, id, params?)` → `WalletBalances`.

**A session is bound to the wallet it signed in with.** Reads (`list`, `get`, `balances`) are account-wide, but `update`, `delete` and the accepted-token methods act only on the session's own wallet: another wallet of the same account is refused `403 not_your_wallet`. An operator session is exempt.

`delete` only deactivates — it is `update(…, { active: false })` under the DELETE verb, and the row stays. Either way the account's **only active wallet** is refused with `422 last_active_wallet`: login resolves the account from a wallet, so an account with none could neither act nor add one back. Another wallet must be active first.

**Switching a wallet back on.** Every switch-off records who did it in `Wallet.deactivated_by`: `'owner'` (a session signed in with that wallet) or `'operator'` (an operator session); `null` while active, and on a switch-off older than the record. A deactivated wallet's session is read-only (`403 wallet_deactivated`) except for one write: `update(accountId, id, { active: true })` on its **own** wallet, which switches it back on when its owner switched it off. A wallet an operator switched off (or with `deactivated_by: null`) is refused `403 wallet_deactivated_by_operator`: an operator's switch-off revokes the key, so only an operator lifts it. The flip side: a wallet its owner switched off can be switched back on by whoever holds its key, so a definitive revocation (a leaked key) must come from an operator.

Accepted tokens: `addToken(accountId, id, { chain_id, token, default? })` → `WalletTokenHolding` (upsert — reactivates a disabled holding instead of duplicating it) · `removeToken(accountId, id, tokenId)` → `void` (soft, keeps the row) · `enableToken(accountId, id, tokenId)` / `disableToken(accountId, id, tokenId)` → `WalletTokenHolding` (404 when the wallet has no holding for that token). `removeToken` and `disableToken` refuse the wallet's **default** holding with `422 default_payment_method` while other holdings are active — make another holding the default first. The **last** active holding can be removed even as the default: the wallet then accepts nothing, and the next holding enabled becomes the default. `tokenId` is the **token's** UUID (as in `WalletTokenHolding.token.…`), not an id of the holding row.

A wallet with no accepted token is invisible to buyers and unusable as a payee: `GET /payment_methods` skips it and `payments.create` answers 422 `unsupported_payment_method`. Onboarding a merchant wallet therefore needs **at least one** `addToken`.

**`redrive` is for one shape of stuck, and the SDK tells you which.** A transaction that is `pending` and whose SIGNED bytes the gateway holds — prepared and signed, never landed (a worker that died between the two, a queue drained by hand) — can be handed to the broadcaster again; nothing about the payment changes. `Transaction.redrivable` is the same predicate the gateway guards the route with, so offer the action on that flag rather than discovering a `422`: a `pending` row with no signed transaction is **not** redrivable, and there the next step is submitting the signature, not retrying a send that never happened.

> **Currently unavailable.** The gateway answers every `wallets.create` with `403 wallet_add_unavailable`. Adding a wallet returns with the merchant wallet-management section, which keeps the request shape and the proof described here.

Adding a wallet requires a **SIWE proof-of-ownership** of the address being added — not just the session JWT. `auth.proveAddress(privateKeyHex, domain, chainId?)` runs that handshake and returns the `message` + `signature` to hand to `create`. Sign with **the added wallet's own key**, not the session key: the gateway rejects a signature that does not recover to `address` (422), and an address already registered anywhere (409 — addresses are globally unique). This lets a merchant prove control of several payee wallets under one account.

```ts
const added = addressFromPrivateKey(addedWalletKey)
const { message, signature } = await client.auth.proveAddress(addedWalletKey, 'api.rail0.xyz')
await client.wallets.create(accountId, { address: added, message, signature, label: 'Payouts' })
```

**The proof is purpose-bound, and a login proof will not do.** The gateway pins each endpoint to one statement and refuses the other with 422 `siwe_purpose_mismatch`:

| Endpoint | Statement | Constant |
|---|---|---|
| `POST /auth` | `Sign in to RAIL0` | `LOGIN_STATEMENT` |
| `POST /accounts/:id/wallets` | `Add this wallet to your RAIL0 account` | `WALLET_LINK_STATEMENT` |

That is a security boundary rather than a label: a login signature is handed out on every sign-in, so a wallet-link endpoint that accepted one would let anyone holding a captured login proof bind that address to their **own** account. `proveAddress` picks the right statement for you — reach for `buildSiweMessage` directly only if you are signing with an external wallet or hardware signer, and pass `WALLET_LINK_STATEMENT` when you do.

### `client.paymentMethods` (public)

Buyer-facing discovery of a merchant's accepted wallets/tokens — **no JWT**. `list(query)` → `WalletWithTokens[]`, where `query` is exactly one of `{ account_id }` (all the merchant's active wallets) or `{ address }` (just that one wallet). Maps the public `GET /payment_methods`; an unknown handle yields `[]`.

```ts
const methods = await client.paymentMethods.list({ address: '0xABC…' })
for (const w of methods) for (const h of w.tokens ?? []) {
  // pay h.token (h.token.symbol on h.token.chain_id) to w.address
}
```

### `client.webhooks` (JWT)

`list(params?)` · `create({ name, callback_url, topics })` — one subscription covers a set of events, with one secret and one circuit breaker; two subscriptions on the same URL must not overlap (409) → `WebhookWithSecret` (secret shown once) · `get(id)` · `update(id, params)` · `enable(id)` · `disable(id)` · `rotateSecret(id)` → `WebhookWithSecret` · `resetCircuit(id)` · `test(id)` → `WebhookTestResult` (sends a signed `webhooks.test` event with no payment to the callback now and reports `delivered`, `response_code`, `response_message`, `error_reason`, `duration_ms`; not logged, not counted by the circuit breaker, works on a disabled webhook) · `eventCallbacks(id, params?)` → `PaginatedResponse<EventCallback>` (filter by `status`, `topic`, `payment_id`, `response_code`, `since`, `until`) · `redeliver(id, callbackId)` → `{ status: 'queued' }` · `delete(id)`. `list` filters by `topic` (a `WebhookTopic`: the subscriptions that include it), `active` and `circuit_state`.

Topics (`WebhookTopic`): `payments.created`, `payments.signed`, `payments.authorized`,
`payments.charged`, `payments.captured`, `payments.voided`, `payments.released`,
`payments.refunded`, `payments.authorization_expiring`, `payments.expired`,
`payments.failed`, `payments.disputed`, `payments.dispute_closed`, and the payout topics
`payouts.confirmed`, `payouts.failed`, `payout_destinations.verified`.

**Payout topics** carry the same envelope (`id`, `emitted_at`, `topic`) with the subject
under its own key instead of `payment`/`transaction`: `payouts.confirmed` and
`payouts.failed` POST `{ id, emitted_at, topic, payout }` (a `Payout`; a failure's reason
is its `error_code` — `reverted`, `foreign_transfer`, `dropped`, `submission_timeout`,
`cancelled`), and `payout_destinations.verified` POSTs
`{ id, emitted_at, topic, payout_destination }`. A payout failed `submission_timeout` or
`dropped` can be revived by a late hash, so a `payouts.failed` with one of those two codes
may be followed by `payouts.confirmed` for the same payout.

**`payments.authorization_expiring`** is the advance notice of `payments.expired`: it
fires **once** per payment, `AUTHORIZATION_EXPIRING_NOTICE` seconds before
`authorization_expiry` (gateway default 86400 — 24h; `0` disables it), for a payment that
is still capturable (`authorized`, `partially_captured` or `partially_refunded`) with a
`capturable_amount` above zero. A payment whose whole authorization window is shorter
than the notice is warned once, as soon as it qualifies; a later partial capture does not
re-arm it. The time left is `payment.authorization_expiry` minus the event's `emitted_at`
— capture before then, or the escrow can only go back to the payer via release, and
`payments.expired` follows.

Every delivery POSTs the same body, whatever the topic: `{ id, emitted_at, topic,
payment: { id, rail0_id, status, mode, amount, payer, payee, token, chain_id,
capturable_amount, authorization_expiry, last_error_code, last_error_message, metadata },
transaction }`, with `transaction` null for events that involve none
(`payments.created`, `payments.signed`, `payments.authorization_expiring`,
`payments.expired`). `capturable_amount` and `authorization_expiry` are on the payment for
every topic, read at delivery time.

**Replaying a lost delivery.** `redeliver` re-sends one recorded delivery's stored payload
verbatim — same embedded event `id`, so a receiver that already processed it deduplicates —
under a fresh timestamped signature. It is the recovery lever for events that failed while
the circuit breaker was open. The replay is **asynchronous** and goes through the normal
delivery job, so the `202` means *queued*, not *delivered*: a disabled or circuit-open
webhook drops it silently. Call `resetCircuit(id)` first — it closes the circuit and clears
a manual disable, whereas `enable(id)` leaves an open circuit open. A callback id that is not
this webhook's, or a row recorded before payloads were stored, answers `404`.

```ts
await client.webhooks.resetCircuit(hookId)
const failed = await client.webhooks.eventCallbacks(hookId, { status: 'failed' })
for (const cb of failed.data) await client.webhooks.redeliver(hookId, cb.id as string)
```

#### Verifying a delivery

Every delivery carries `X-Rail0-Topic`, `X-Rail0-Timestamp` (unix seconds) and
`X-Rail0-Signature` — a hex HMAC-SHA256 over `"{timestamp}.{body}"`, keyed with the
`shared_secret` shown once at create/rotate. `verifyWebhookSignature` checks the digest
in constant time **and** the timestamp against a ±300s window; the timestamp is inside
the signed string precisely so that a captured delivery cannot be replayed forever, so
checking the digest alone is not verification.

```ts
import { verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_TIMESTAMP_HEADER } from '@commercelayer/rail0-sdk'

export async function POST(request: Request) {
  // The RAW body. Verify before JSON.parse — re-serialising a parsed object changes
  // key order and whitespace, and the digest with it.
  const body = await request.text()
  const ok = verifyWebhookSignature({
    body,
    signature: request.headers.get(WEBHOOK_SIGNATURE_HEADER),
    timestamp: request.headers.get(WEBHOOK_TIMESTAMP_HEADER),
    secret: process.env.RAIL0_WEBHOOK_SECRET!,
  })
  if (!ok) return new Response('invalid signature', { status: 401 })

  const event = JSON.parse(body)
  if (event.topic === 'payments.authorization_expiring') {
    // Seconds left before the hold lapses: capture now or lose the sale.
    const secondsLeft = event.payment.authorization_expiry - Date.parse(event.emitted_at) / 1000
  }
  // …handle the other topics
  return new Response(null, { status: 204 })
}
```

It returns a boolean and never throws — a spoofed request is an expected condition on a
public endpoint, and every failure (missing header, blank secret, unparseable timestamp,
stale clock, bad digest) deserves the same 401. `expectedWebhookSignature(body,
timestamp, secret)` is exposed for when you need to diff the two sides to debug a
rejection, and `tolerance` / `nowSeconds` are injectable. No `node:crypto`: the digest
comes from `@noble/hashes`, already a dependency, so the helper works wherever the rest
of the SDK does (a test pins byte-equality with node's implementation).

**Rotating the secret without a gap.** After `rotateSecret` the gateway keeps the replaced
key for a grace window (`WEBHOOK_SECRET_GRACE`, one hour by default): inside it every
delivery carries `X-Rail0-Signature` under the new key **and** `X-Rail0-Signature-Previous`
(`WEBHOOK_SIGNATURE_PREVIOUS_HEADER`) under the old one, so an endpoint verifies with
whichever key it has deployed and nothing in flight at rotation becomes unverifiable.
Deploy the new secret at your pace within the window; an endpoint that still holds the old
one verifies the previous header instead — the old key signs only, and is never honoured
past the window. A second rotation inside it drops the oldest key.

```ts
const verify = (signature: string | null) =>
  verifyWebhookSignature({ body, signature, timestamp, secret: process.env.RAIL0_WEBHOOK_SECRET! })
const ok =
  verify(request.headers.get(WEBHOOK_SIGNATURE_HEADER)) ||
  verify(request.headers.get(WEBHOOK_SIGNATURE_PREVIOUS_HEADER))
```

### `client.payoutDestinations` / `client.payouts` (merchant, JWT)

The on-chain leg of a merchant cash-out: an ERC-20 `transfer` from one of the account's
wallets to a deposit address at a venue — an exchange, Circle Mint, another wallet. The
gateway builds the transfer and the merchant's key signs it; it never holds funds, keys or
fiat, and never talks to the venue.

**1. Register a destination — with the merchant's confirmation.** A destination is bound
to ONE chain and ONE token: an exchange credits only the network it issued the address
for. `confirm_details: true` is **required** (422 `confirmation_required` otherwise) and
is typed as the literal `true`: it records the merchant's statement of the `details_v1`
text, exported as `PAYOUT_DETAILS_CONFIRMATION.text`:

> I have checked the address, network, token and minimum deposit on the venue's deposit
> page and confirm they are correct. Funds sent to a wrong address or network, or below
> the venue's minimum, may be permanently lost and cannot be recovered by rail0.

Show it, and set the flag only once the merchant has made that check — the SDK never sets
it for you.

```ts
import { PAYOUT_DETAILS_CONFIRMATION } from '@commercelayer/rail0-sdk'

const destination = await merchant.payoutDestinations.create({
  wallet_id: walletId,               // the session's own wallet
  chain_id: 5042002,
  token: USDC,
  address: '0x…',                    // issued by the venue FOR THIS CHAIN
  kind: 'exchange',                  // exchange | circle_mint | self_custody | provider
  min_amount: '11000000',            // the venue's deposit minimum, base units (optional)
  confirm_details: true,             // the merchant confirmed PAYOUT_DETAILS_CONFIRMATION.text
})                                   // → status 'unverified'
```

**2. Prove it: proof → confirm.** A new destination is `unverified` and may receive the
proof amount at most (`payout_destination_unverified`). Send the proof — the gateway's
`PAYOUT_PROOF_AMOUNT` (1 token unit by default), raised to `min_amount` when that is
higher — and once it is confirmed on-chain AND the venue shows it credited, attest it:

```ts
await merchant.payouts.prepareAndSubmit(
  { destination_id: destination.id, purpose: 'proof' },
  MERCHANT_KEY,
  { destination, maxAmount: '11000000' },  // cap what the gateway may decide
)
// … the proof is `confirmed` and the venue credited it …
await merchant.payoutDestinations.confirm(destination.id)  // → 'verified', fires payout_destinations.verified
```

**3. Pay out: prepare → verify → sign → submit.** `amount` is a human decimal or `"all"`
(the balance minus the refund reserve). The prepared `Payout` carries
`unsigned_transaction` beside its decoded intent (`chain_id`, `token`, `address`,
`amount`); the signer holds the transaction to it **before** the key touches it:

```ts
// One call: prepare, verify, sign, submit.
await merchant.payouts.prepareAndSubmit(
  { destination_id: destination.id, amount: '250.00' },
  MERCHANT_KEY,
  { destination, decimals: 6 },  // decimals from YOUR records: required to check a typed amount
)

// Or step by step (or with another signer: verifyPayoutTransaction, then sign elsewhere).
const payout = await merchant.payouts.prepare({ destination_id: destination.id, amount: '250.00' })
const raw = signPayoutTransaction(payout.unsigned_transaction, MERCHANT_KEY, {
  payout, destination, amount: '250.00', decimals: 6,
})
await merchant.payouts.submit(payout.id, { signed_transaction: raw })

// Or broadcast from the wallet yourself and report the hash.
await merchant.payouts.submitByHash(payout.id, { transaction_hash })
```

**What `signPayoutTransaction` verifies, and why.** For a plain transfer the calldata
**is** the money, so there is no unchecked form. `verifyPayoutTransaction` refuses
(`Error("refusing to sign: …")`, nothing signed) unless: `value` is zero; `chain_id` is
the payout's chain; `from` is your key's address; `to` is an address equal to the payout's
**token**; and the calldata is **exactly** `transfer(payout.address, payout.amount)` —
selector `0xa9059cbb`, a left-padded recipient word, the amount word, nothing after. The
payout's fields come from the same gateway, so the optional checks bind them to **your**
input: `destination` (your record — chain, token, address, id must match), `amount` with
`decimals` (the decimal you typed, checked to the unit; `"all"` is the gateway's to
decide, so cap it with `maxAmount`). `decimals` must come from your own records, not the
gateway: a reported scale could inflate the amount. `prepareAndSubmit` also refuses a
payout prepared for another destination or purpose.

**Minimum and reserve.** `min_amount` is the venue's deposit minimum (base units; `null`
= none): a payout below it is refused at prepare and again at submit with
`payout_below_minimum` — a deposit under a venue's minimum may never be credited.
Changing it is `update(id, { min_amount, confirm_details: true })` (the type requires the
confirmation whenever `min_amount` is present; `''` removes it); raising it above the
latest proof's amount takes the verification away, so send a new proof at the new
minimum. `reserve_amount` is what an `"all"` payout leaves in the wallet — `null` means
`suggested_reserve`, the refundable balance of the wallet's payments still inside their
refund window, because a refund pulls from the payee wallet.

**Stuck or failed.** One pending payout per destination: a re-prepare replaces it while
unsigned. Once a signature is stored (`signed: true`, `transaction_hash` set — even if the
broadcast failed with a 502) it may still be mined, so it is `resend(id)`, never
re-prepared or cancelled (409 `payout_already_signed`). `cancel(id)` fails an unsigned
pending payout with `cancelled`. A payout failed `submission_timeout` or `dropped` comes
back with `submitByHash` and the late or replacement hash.

`payoutDestinations`: `list(params?)` → `PaginatedResponse<PayoutDestination>` (filter
`wallet_id`, `status`) · `create(params)` · `get(id)` · `update(id, params)` (`label`,
`reserve_amount`, `min_amount` + `confirm_details`, `active` — `false` disables, any wallet
of the account may) · `confirm(id)` · `events(id, params?)` → `PaginatedResponse<PayoutEvent>`
(the destination's audit trail and its payouts', newest first).

`payouts`: `list(params?)` → `PaginatedResponse<Payout>` (filter `destination_id`,
`wallet_id`, `status` — one or an array, `purpose`, `created_from`/`created_to`; `sort`) ·
`get(id)` · `events(id, params?)` · `prepare(params)` · `submit(id, { signed_transaction })` ·
`resend(id)` · `cancel(id)` · `submitByHash(id, { transaction_hash })` ·
`signAndSubmit(payout, key, check?)` · `prepareAndSubmit(params, key, check?)`.

A deactivated account is read-only here: every payout and destination write is 403
`account_deactivated`. Writes act for the destination's own wallet (403 `not_your_wallet`).

### Pagination

Every `PaginatedResponse<T>` carries `{ data, meta }`. `meta` is `{ page, per_page, total, total_pages, links }`.

`page` is 1-based and bounded to `1..1,000,000` — the gateway answers `400` outside it.

`total_pages` is **zero** for an empty collection — "no pages" is what there are, so a pager rendered off it renders none. `links` comes from the `Link` header: `first` and `last` are always present, `prev` and `next` only where they exist, and the object is empty when the collection is. The URIs are **relative** (path + query) and resolve against the URL you requested — the gateway emits them that way so they cannot advertise the wrong scheme through a TLS-terminating proxy.

```ts
let page = await client.payments.list({ per_page: 100 })
while (page.meta.links.next) {
  page = await client.payments.list({ page: page.meta.page + 1, per_page: 100 })
}
```

### `client.disputes` (JWT)

> **Operations go through the gateway.** The gateway mirrors only the operations it prepared. A dispute, close-dispute, capture, void, refund or release sent to the RAIL0 contract directly — outside this SDK's prepare/submit calls — happens on-chain, but the payment's status and balances on the gateway do not change and no webhook is sent; a merchant is not told about a dispute its buyer opened that way. The gateway records it for its operators as a sync error (`external_operation`).

Account-level dispute list — every dispute (open **and** closed) across the caller's payments, each with its parent `payment` embedded. Complements `payments.disputes(id)` (one payment's history); unlike the `disputed` filter on `payments.list` (current-state), it still surfaces closed disputes.

`list(params?)` → `PaginatedResponse<Dispute>` — `params`: `{ status?: 'open' | 'closed', sort?, page?, per_page? }`.

### Dispute reasons

A dispute can be opened and closed with a reason from the gateway's **dispute-reason dictionary** (rail0-gateway#381), or with none (rail0-gateway#382). On-chain a reason is a `bytes32`, `keccak256("rail0.dispute.<code>")`. The dictionary ships as **build-time constants** generated from the OpenAPI spec (`x-enum-descriptions` / `x-enum-bytes32`) — no gateway call:

| Constant | Codes |
|---|---|
| `DISPUTE_OPEN_REASONS` | `not_received`, `not_as_described`, `damaged_or_defective`, `duplicate`, `incorrect_amount`, `cancelled`, `refund_not_received`, `unauthorized`, `other` |
| `DISPUTE_CLOSE_REASONS` | `resolved_with_merchant`, `withdrawn`, `item_received`, `other` |
| `DISPUTE_SYSTEM_CLOSE_REASONS` | `full_refund` — recorded by the protocol when a full refund auto-closes a dispute; never sent |

Each entry is a `DisputeReasonEntry` `{ code, description, bytes32 }` (types: `DisputeOpenReason`, `DisputeCloseReason`, `DisputeSystemCloseReason`).

```ts
import { DISPUTE_OPEN_REASONS, lookupDisputeReason } from '@commercelayer/rail0-sdk'

await client.payments.disputePrepare(id, 'not_received') // or the code's exact bytes32
await client.payments.closeDisputePrepare(id, 'item_received')
await client.payments.closeDisputePrepare(id) // no reason: on-chain bytes32 zero

lookupDisputeReason('0x8b8e…28f9', 'open')?.description // 'Goods or service not received'
```

- **`reason` is optional** on `disputePrepare` / `closeDisputePrepare`. Omitted (or the all-zero bytes32) means no reason: the calldata carries bytes32 zero. A supplied non-zero value outside the dictionary (or from the other side's list) — including `full_refund` on close — is refused `422 unknown_dispute_reason`.
- `lookupDisputeReason(codeOrBytes32, 'open' | 'close')` resolves a code or bytes32 (any case); the side is required because `other` exists on both with different descriptions. `'close'` also resolves `full_refund`.
- A `Dispute` carries `reason_code` / `reason_description` and `close_reason_code` / `close_reason_description` beside the raw `reason` / `close_reason`. The zero bytes32 (no reason given) reads `reason_code: null` with description `NO_DISPUTE_REASON` (`"No reason given"`); a non-zero bytes32 outside the dictionary (a direct contract call) reads `reason_code: null` with description `UNRECOGNISED_DISPUTE_REASON` (`"Unrecognised reason"`).

> **Changed after 1.6.0:** `reason` is no longer free-form — when supplied it must be a dictionary code or its exact bytes32. It stays optional (rail0-gateway#382).

### `client.analytics` (merchant, JWT + account)

Merchant sales analytics over the account's **own** payments as payee. Account-only: every method needs a JWT with a non-null account — `401` without a token, `403` for an account-less (buyer) session. All three take the same optional `AnalyticsFilters`: `{ mode?, status?, token?, chain_id?, from?, to?, payee? }` (`from`/`to` are ISO-8601; `token` + `chain_id` together scope monetary volume to a single token, so sums never mix decimals). By default the rollups cover **all** the account's wallets; `payee` (a 0x address) scopes them to one of them — it must be one of the session account's wallets (`403` otherwise, `400` if malformed).

- `summary(filters?)` → `AnalyticsSummary` — `{ orders, disputed, refund_rate, dispute_rate, failed_rate, by_status, failures, volume, gas, gas_by_status, gas_by_operation }`, where `volume` is one `AnalyticsVolume` per `(token, chain)` with base-unit `gross` (authorized), `settled` (net of refunds), `escrowed` (still held), and gross `captured`/`refunded` strings from the confirmed transactions.
  `failures` is one row per decoded failure code with how many transactions hit it, commonest first: `failed_rate` says how much fails, this says what to act on — a revert is a state problem, a rejection that never reached the chain is a wallet problem.
  `gas` is one `AnalyticsGas` per **chain** — `spent` on confirmed transactions, `wasted` by on-chain reverts, in that chain's **native** token (wei-scale strings, `decimals` 18), so it is never summed across chains — plus `confirmed`/`failed` counts and the `failed_rate` derived from them (per resolved **transaction**, not per order). It covers only the operations the merchant broadcasts: `dispute`/`close_dispute` are the buyer's cost and `release` has no stored sender.
  `gas_by_status` and `gas_by_operation` are those same rows regrouped as `AnalyticsGasSlice[]`, each carrying a `key`; every cut sums back to its chain's `gas` row. Chain and status rows also carry `orders`, so `(spent + wasted) / orders` is the average cost of an order in that state — counting the orders that produced no transaction and so cost nothing. It is `null` on the operation cut, where one order spans several operations and `spent / confirmed` (the cost of one occurrence) is the meaningful average. The status cut is a **snapshot** — a payment's status moves and its gas moves with it, so the same period changes over time — while the operation cut is stable.
- `timeseries(filters?, { interval? })` → `AnalyticsBucket[]` — order count per bucket (oldest first); `interval` is `'day'` (default) | `'week'` | `'month'`. `volume` is a base-unit string only when both `token` and `chain_id` are filtered, else `null`.
- `breakdown(filters, { by })` → `AnalyticsRow[]` — aggregate by `by`: `'token'` | `'chain'` | `'mode'` | `'status'` | `'operation'`. `token`/`chain` rows carry `volume`; `mode`/`status` rows are counts only; `operation` groups the merchant's own CONFIRMED transactions and carries `transactions` (how often it ran — a partial capture runs several times on one order) beside `orders` (how many it touched).

```ts
await client.auth.login(privateKeyHex, 'api.rail0.xyz') // authenticates `client`
const kpis  = await client.analytics.summary({ mode: 'charge' })
// Gas is per chain: format each row with its own symbol, never add them up.
for (const g of kpis.gas) console.log(g.chain_name, formatAmount(g.spent, g.decimals ?? 18), g.symbol)
const daily = await client.analytics.timeseries({}, { interval: 'day' })
const byTok = await client.analytics.breakdown(undefined, { by: 'token' })
// One wallet only (must belong to the session account):
const mine  = await client.analytics.summary({ payee: '0xYourWalletAddress' })
```

### `client.accounts` (merchant, JWT)

`get(accountId)` → `Account` — the profile (`id`, `name`, `email`, `priority_tip`, `authorization_ttl`, `refund_ttl`, `payment_windows`, timestamps) · `update(accountId, { name?, email?, priority_tip?, authorization_ttl?, refund_ttl? })` → `Account`.

Behind SIWE and behind an ownership guard: the gateway requires a JWT whose account matches
the path — or an active **admin** session, which may read and repair any account. A
merchant therefore only ever reaches its own. An id that is not an account answers `404`,
the same shape a non-admin gets for another account's id, so the pair cannot be used to
tell whether an account exists.

`update` changes the account's own `name`, `email`, `priority_tip` and/or payment windows: at least one is
required (`400` otherwise), and name and email are unique across accounts (`409` when
taken). It is a write, so the session's standing matters — a deactivated session wallet
answers `403 wallet_deactivated` and a deactivated account `403 account_deactivated`. The
account's `active` flag is the operator's and is not exposed here.

**`priority_tip`** is the fee setting of the account's **own** transactions (authorize,
capture, void, release, refund): `true`, the default, tips the network's suggested priority
fee; `false` uses the chain's minimum tip (0 on most chains, 25 gwei on Polygon PoS/Amoy) —
cheaper, slower to confirm under load. The buyer's dispute/close-dispute never read it.

**Payment windows** — `authorization_ttl` (how long an authorization can be captured) and
`refund_ttl` (how long a payment can be refunded or disputed), in seconds — are the deadlines
the account's **new** payments are created with: the account's own value, or the gateway
default. `update` sets one with a number of seconds, or puts it back on the default with
`null`. `payment_windows` (`PaymentWindows`) says which are the account's own and gives the
bounds: authorization between `min` and `max`, refund at most `max`, and the refund window
at least `min_refund_window` (one day) past the authorization — `422
invalid_payment_windows` otherwise. A payment's deadlines are signed into it, so a change
moves only the payments created afterwards.

```ts
const me = await client.accounts.get(session.accountId)
console.log(me.name, me.email, me.priority_tip)
await client.accounts.update(session.accountId, { email: 'ops@merchant.example' })
await client.accounts.update(session.accountId, { priority_tip: false })
// Two-day capture window, refund window back on the gateway default.
await client.accounts.update(session.accountId, { authorization_ttl: 2 * 86_400, refund_ttl: null })
```

The account's wallets are on `client.wallets` (a collection under the same path), and
buyer-facing discovery on `client.paymentMethods`.

### `client.chains` / `client.tokens` / `client.health`

`chains.list(params?)` → `Blockchain[]` (filter by `{ network_type, symbol }`; each chain carries `contract` — the RAIL0 deployment new payments open against, typed `ChainContract`: `address`, `version`, `deployed_at`, nullable for a chain with no deployment. Since 1.2.0 `Blockchain` is an alias of the schema component, so it types `contract` and picks up future fields on regenerate; each chain also carries `settlement`, typed `BlockchainSettlement` — see below) · `tokens.list(chainId?, symbol?, active?)` → `Token[]` (every token by default, retired ones included — each carries `active`; pass `active: true` where only what a new payment can use should be offered) · `health.get()` → `Health`.

**Slugs and public RPCs.** Each chain carries `slug` — a short name shared by its testnet and mainnet (`arc`), unique per `network_type` — and `public_rpc_urls`, keyless RPC endpoints for reading the chain directly, in failover order. `resolveChain(chains, ref)` picks one chain from a `chains.list()` result by slug (case-insensitive) or numeric chain id (a number or a digit string); it throws naming the available slugs when nothing matches, and on a slug that matches more than one chain (a list mixing testnet and mainnet):

```ts
const arc = resolveChain(await client.chains.list(), 'arc') // or 5042002, or '5042002'
```

**Measured settlement time.** Every chain carries `settlement: { p50_seconds, p90_seconds,
sample_size, window_days }` — how long an operation has taken from broadcast
(`submitted_at`) to confirmation (`confirmed_at`) **on this gateway**, over the confirmed
transactions of the trailing `window_days` (7 by default). It is end-to-end — the chain's
finality lag plus the gateway/indexer pipeline — so it is what a client actually waits
for. The object is always present; the percentiles are `null` below the gateway's minimum
sample (20), and `sample_size` says why. The figures are cached by the gateway (refreshed
at most every 10 minutes) and deliberately a long-window capacity figure, not a live alarm.

Use it as a wait-deadline **hint**, not a guarantee: a small multiple of `p90_seconds`,
with a fixed fallback for when it is null.

```ts
const chains = await client.chains.list()
const chain = chains.find((c) => c.chain_id === payment.chain_id)
const p90 = chain?.settlement.p90_seconds
const deadlineSeconds = p90 == null ? 15 * 60 : Math.max(3 * p90, 60)
```

### `client.auth`

`getNonce()` → `{ nonce, expiresAt }` · `verify(message, signature)` → `AuthResponse` (`token`, `address`, `accountId`, `name`, `expiresAt`, and `admin` — true only for an account holding the operator grant; visibility only, every gated route re-checks it) · `login(privateKeyHex, domain, chainId?)` → `AuthResponse` (full SIWE flow; `chainId` defaults to 1 — the gateway also accepts the id of any chain it has active, see `GET /blockchains`; any other value is 422 `siwe_chain_mismatch`) · `logout()` → `{ revoked }` (this TOKEN) · `revokeAll(privateKeyHex, domain, chainId?)` → `{ revokedAll, cutoffAt }` · `proveAddress(privateKeyHex, domain, chainId?)` → `{ message, signature }` (the wallet-link proof — see `client.wallets`).

**`login` and `verify` authenticate the client they run on.** On success the token is installed on that client, and still returned in `AuthResponse` for callers that persist it; a failed call leaves the current token untouched. A server that verifies *someone else's* signature (relaying a user's sign-in) therefore holds that user's session on the client afterwards — use one client per sign-in there (as a per-request client already does), or clear it with `setAuthToken(null)`.

**`logout` and `revokeAll` answer different questions.** `logout` ends the session whose token this client carries, so signing out one device leaves the others signed in. `revokeAll` ends **every** session of the calling address — including the ones you have never seen, which is the whole case for a key you no longer trust: five live sessions would otherwise need five tokens you do not hold. The gateway records a **cutoff instant** rather than enumerating tokens, so a session minted a moment earlier is refused by its own `iat`. That instant is what `cutoffAt` carries, and it is the value worth logging: it says exactly which sessions died, which a boolean cannot.

`revokeAll` is authorized by a **fresh SIWE proof** of the address rather than by the session — whoever reacts to a leaked key holds the wallet, not the stolen token — so it takes the private key and the gateway host, like `login`, and signs a message carrying its own statement (`REVOKE_ALL_STATEMENT`, "Sign out of RAIL0 everywhere"), which a login proof cannot replay. The cutoff includes this client's own session: sign in again afterwards.

### Logging

Pass any `(entry: LogEntry) => void` as `logger`, or the built-in `debugLogger`:

```typescript
import { debugLogger } from '@commercelayer/rail0-sdk'
const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz', logger: debugLogger })
// [rail0] POST 202 https://.../payments/0x.../authorize 87ms
```

## Error handling

Every 4xx / 5xx throws a `Rail0ApiError` carrying the gateway's code/title/detail
triple, plus `.status` (HTTP code) and — on `429` — `.retryAfter`:

```typescript
import { Rail0ApiError } from '@commercelayer/rail0-sdk'

try {
  await client.payments.capture(id, { signed_transaction })
} catch (err) {
  if (err instanceof Rail0ApiError) {
    console.error(err.code)   // branch on this: 'insufficient_token_balance'
    console.error(err.title)  // short label: 'Not enough balance'
    console.error(err.detail) // a sentence you can show a user verbatim
    if (err.status === 429 && err.retryAfter) await sleep(err.retryAfter * 1000)
  }
}
```

**`.code` is the only field to branch on** — the specific condition, straight from the
gateway's `code`. A body that is not JSON (a proxy's HTML 502) still yields one:
`code: 'unknown_error'` with `detail: 'HTTP <status>'`. `.error` is a deprecated alias
that always equals `.code`.

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
on a `429` (the gateway's rate limiter advertises its window), or `undefined`. A `429` is
retried automatically only with `retryOn429: true` (see [Rate limits](#rate-limits));
otherwise back off using this value.

`err.hint` (or `describeError(code)`) is this SDK's own local advice, a *supplement* to
`.detail` rather than a replacement — present only for codes worth adding a next step
to, `undefined` otherwise.

### Ids in request paths

Every id a method puts into the URL path is encoded as one segment (`encodeURIComponent`), so an id carrying `/`, `?` or `#` cannot address a different route. An id that is empty, `.` or `..` is refused with a `TypeError`, thrown synchronously before any request, as rail0-go and rail0-ruby do.

## Development

```bash
pnpm test        # or bin/test (installs dependencies if missing; args pass to vitest)
pnpm typecheck   # src, examples and test
pnpm lint        # biome over src, gen, examples, test

# Regenerate types + resources from the gateway's OpenAPI schema:
#   default source is ../rail0-gateway/docs/openapi.json
#   override with RAIL0_SCHEMA_PATH=/abs/path/openapi.json  (or RAIL0_SCHEMA_URL)
pnpm generate
```

### Releasing

A release is an approved pull request: merging it is what publishes.

1. `bin/release-prepare` (or `pnpm release:prepare`), on an up-to-date, clean `main`. It computes the version from the titles of the pull requests merged since the last tag
   (Conventional Commits): a breaking change — `!` after the type, as in `feat(api)!:`, or a
   `BREAKING CHANGE:` footer — makes it a major, any `feat` a minor, anything else a patch,
   and it refuses when nothing merged. `bin/release-prepare minor` (or `patch`, `major`,
   `X.Y.Z`) sets it by hand instead. The release PR says which pull requests decided it.
   It then bumps `package.json`, writes the
   release notes from the pull requests merged since the last tag, and opens
   `chore(release): vX.Y.Z`. `--dry-run` prints all of it and writes nothing.

   **Or on a feature branch**, to release a change in the same review: run it on a clean
   branch that is pushed, contains `origin/main` and has an open pull request into `main`.
   The bump is committed and pushed on that branch (`chore(release): vX.Y.Z`), the pull
   request's own title counts toward the version, gets a line in the notes and gains a
   ` (release vX.Y.Z)` suffix, and the
   notes go into its description between `<!-- release:start -->` markers — the text above
   them is kept. Re-run it after new commits or a merge of `main`: it refreshes the version
   and the notes instead of bumping twice. One approval then covers the change and its
   release.
2. Review the pull request (edit the notes in its body if needed), approve and merge it.
   The approval must come from a reviewer **other than the pull request's author**, on its
   final commit: release.yml checks it before publishing anything and stops otherwise —
   an admin merge that bypassed the review, a direct push to `main` or a resume of an
   unapproved release publishes nothing.
3. `.github/workflows/release.yml` runs on that push to `main`: CI again on the release
   commit, `npm publish` with provenance, then the tag `vX.Y.Z` and the GitHub release
   (notes from the pull request), then a Slack message.

A merge that does not change the version releases nothing. If a run stops halfway, Actions
→ release → Run workflow (on `main`) resumes it: what is already on npm or already tagged
is skipped. Publishing from a laptop is not supported — there is no `publish:npm` script,
and no registry token exists anywhere: npm **Trusted Publishing** trusts only
`release.yml` in this repo.

One-time settings (repository admins):

- environment `release` (Settings → Environments), deployment limited to `main`;
- on npmjs.com, the package's Trusted Publisher (organization `commercelayer`, repository
  `rail0-ts`, workflow `release.yml`) bound to environment `release` — only once the new
  `release.yml` is on `main`;
- a tag ruleset on `v*`: block updates and deletions, restrict creation to GitHub Actions
  and admins;
- branch protection on `main`: required `ci` check, "Include administrators";
- the Slack channel: `release.yml` posts through the `PIPELINE_SLACK_CHANNEL_WEBHOOK_URL`
  secret, named in one place (the `announce` job).

## Project structure

```text
gen/
  generate.ts     regenerates src/api.ts + resources + dispute-reasons.ts from the gateway OpenAPI

src/
  core/
    error.ts      Rail0ApiError
    http.ts       HttpClient (fetch, timeout, retry, logging, getPaginated)
    backoff.ts    rate-limit wait (throttleDelayMs)
    path.ts       path-segment encoding for ids
  resources/
    types.ts      gateway-vocabulary types (Payment, Dispute, Webhook, …)
    payments.ts   PaymentsResource (lifecycle + disputes)
    disputes.ts   DisputesResource (account-level list)
    accounts.ts   AccountsResource (the account profile: read, update)
    wallets.ts    WalletsResource  (CRUD, balances)
    payment_methods.ts  PaymentMethodsResource (public discovery)
    webhooks.ts   WebhooksResource
    payout_destinations.ts  PayoutDestinationsResource (cash-out addresses)
    payouts.ts    PayoutsResource (prepare → verify → sign → submit)
    analytics.ts  AnalyticsResource (merchant sales rollups)
    chains.ts     ChainsResource
    tokens.ts     TokensResource
    health.ts     HealthResource
    auth.ts       AuthResource (SIWE)
  api.ts          raw types generated from the gateway OpenAPI
  amounts.ts      toBaseUnits / formatAmount
  stablecoins.ts  static stablecoin registry
  signing.ts      EIP-3009 / EIP-1559 signing helpers
  tx-verify.ts    pre-sign verification (payment transactions, authorizations, payout transfers)
  webhook-signature.ts  webhook delivery verification (HMAC + freshness)
  dispute-reasons.ts    dispute-reason dictionary constants (generated from the OpenAPI)
  client.ts       Rail0Client — assembles the resources
  index.ts        public re-exports
```

## License

[MIT](LICENSE)
