// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.

// Raw generated types for advanced use.
import type { components } from '../api.js'

export type { components, operations } from '../api.js'

// ── Primitive aliases ────────────────────────────────────────────────
/** Checksummed or lowercase Ethereum address (42 chars, 0x-prefixed). */
export type Address = string
/** 32-byte value, hex-encoded (66 chars, 0x-prefixed). */
export type Bytes32 = string
/** Unsigned 256-bit integer serialised as a decimal string. */
export type Uint256String = string

// ── Enums ────────────────────────────────────────────────────────────
export type PaymentMode = 'authorize' | 'charge'
export type PaymentStatus =
  | 'unsigned'
  | 'signed'
  | 'authorized'
  | 'charged'
  | 'captured'
  | 'partially_captured'
  | 'voided'
  | 'released'
  | 'refunded'
  | 'partially_refunded'
  /**
   * A never-captured authorization whose window lapsed, marked by the gateway's Janitor
   * and announced by the payments.expired topic.
   *
   * NOT terminal, and that is the part worth knowing: the escrow is still on-chain, so
   * release still works from here (and closes the payment as `released`). Treating this
   * as closed leaves the buyer's funds where they are.
   */
  | 'expired'
/**
 * The six fund operations that have prepare/submit endpoints — the values that
 * can appear in a `/payments/:id/:operation` path, and the argument type of
 * prepare/submit/submitByHash.
 *
 * DELIBERATELY NARROWER than what a transaction ROW can hold: see
 * `StoredTransactionOperation` for that. The two are genuinely different
 * questions — which endpoints exist, versus which values the stored column can
 * carry — and conflating them is what produced the bug below.
 */
export type TransactionOperation =
  | 'authorize'
  | 'charge'
  | 'capture'
  | 'void'
  | 'release'
  | 'refund'
/**
 * Every operation a transaction ROW can carry: the six above plus `dispute` and
 * `close_dispute`, which have their own payer-only routes rather than living
 * under the generic namespace but mint rows like any other operation.
 *
 * This is the type to compare a row's `operation` against, and the type of the
 * `operation` filter on `payments.transactions()`. It used to be missing, so
 * `tx.operation === 'dispute'` was a TS2367 "comparison appears unintentional"
 * for a value that genuinely arrives at runtime, and the row was reachable only
 * through a cast — the gateway spec's `Transaction.operation` enum listed only
 * six (commercelayer/rail0-gateway#177, fixed).
 */
export type StoredTransactionOperation = NonNullable<
  components['schemas']['Transaction']['operation']
>
export type TransactionStatus = 'pending' | 'submitting' | 'submitted' | 'confirmed' | 'failed'
export type DisputeStatus = 'open' | 'closed'
/**
 * The dispute-reason dictionary codes (rail0-gateway#381). On-chain a reason is a
 * bytes32, keccak256("rail0.dispute.<code>"); the descriptions and bytes32 values
 * for each code ship as build-time constants in `dispute-reasons.ts`
 * (DISPUTE_OPEN_REASONS, DISPUTE_CLOSE_REASONS, DISPUTE_SYSTEM_CLOSE_REASONS).
 */
export type DisputeOpenReason = components['schemas']['DisputeOpenReason']
export type DisputeCloseReason = components['schemas']['DisputeCloseReason']
/** Recorded by the protocol itself (a full refund auto-closing a dispute) — never sent. */
export type DisputeSystemCloseReason = components['schemas']['DisputeSystemCloseReason']
export type CircuitState = 'closed' | 'open'
/**
 * A delivery either arrived or did not. There is no 'pending': the row is written after
 * the attempt, and the gateway's CHECK constraint allows exactly these two — so typing a
 * third value invited a filter that can only ever return nothing.
 */
export type EventCallbackStatus = 'delivered' | 'failed'
export type HealthStatus = 'ok' | 'degraded'
/**
 * Webhook event topics. Mirrors the gateway's WebhookTopic enum.
 *
 * `payments.authorization_expiring` is the advance notice of `payments.expired`: sent
 * ONCE per payment, `AUTHORIZATION_EXPIRING_NOTICE` seconds (gateway default 86400, 24h)
 * before `authorization_expiry`, while the payment is still capturable with a
 * `capturable_amount` above zero. Time left is `payment.authorization_expiry` minus the
 * event's `emitted_at`; capture before then, or the escrow can only go back via release.
 *
 * The payout topics carry the same envelope (`id`, `emitted_at`, `topic`) with the
 * subject under its own key instead of `payment`/`transaction`: `payouts.confirmed` and
 * `payouts.failed` POST `{ id, emitted_at, topic, payout }` (a `Payout`, its failure
 * reason in `error_code`), and `payout_destinations.verified` POSTs
 * `{ id, emitted_at, topic, payout_destination }` (a `PayoutDestination`). A payout failed
 * `submission_timeout` or `dropped` can be revived by a late hash, so a `payouts.failed`
 * with one of those two codes may be followed by `payouts.confirmed` for the same payout.
 */
export type WebhookTopic =
  | 'payments.created'
  | 'payments.signed'
  | 'payments.authorized'
  | 'payments.charged'
  | 'payments.captured'
  | 'payments.voided'
  | 'payments.released'
  | 'payments.refunded'
  | 'payments.authorization_expiring'
  | 'payments.expired'
  | 'payments.failed'
  | 'payments.disputed'
  | 'payments.dispute_closed'
  | 'payouts.confirmed'
  | 'payouts.failed'
  | 'payout_destinations.verified'
/** What a payout destination is: the venue its deposit address belongs to. */
export type PayoutDestinationKind = 'exchange' | 'circle_mint' | 'self_custody' | 'provider'
/**
 * `unverified` (born so; may receive the proof amount at most), `verified` (the merchant
 * attested the venue credited the proof), `disabled` (switched off; `active: true`
 * restores the verification it had).
 */
export type PayoutDestinationStatus = 'unverified' | 'verified' | 'disabled'
/** `proof`: the small transfer that verifies a destination. `payout`: a cash-out. */
export type PayoutPurpose = 'proof' | 'payout'
/**
 * `pending` (prepared; may already be signed — see `Payout.signed`), `submitted`
 * (broadcast or reported by hash), `confirmed` (the receipt carries this exact ERC-20
 * Transfer), `failed` (`error_code` says why).
 */
export type PayoutStatus = 'pending' | 'submitted' | 'confirmed' | 'failed'
/** What a payout audit event records, e.g. `destination.min_amount_changed`, `payout.signed`. */
export type PayoutEventAction = NonNullable<components['schemas']['PayoutEvent']['action']>

// ── Signing types (not named in the spec; hand-authored, as in rail0-go) ──
export interface EIP712Domain {
  name: string
  version: string
  chainId: number
  verifyingContract: Address
}
export interface EIP3009Message {
  from: Address
  to: Address
  value: Uint256String
  validAfter: Uint256String
  validBefore: Uint256String
  nonce: Bytes32
}
/** Immutable payment configuration returned inside a payment record. */
export interface PaymentConfig {
  payer: Address
  payee: Address
  token: Address
  amount: Uint256String
  authorization_expiry: number
  refund_expiry: number
}
/** EIP-712 typed-data payload to pass to eth_signTypedData_v4 (or the SDK signer). */
export interface SigningPayload {
  domain: EIP712Domain
  types: Record<string, unknown>
  primaryType: string
  message: EIP3009Message
}

// ── Request bodies ───────────────────────────────────────────────────
export interface CreatePaymentRequest {
  chain_id: number
  mode: PaymentMode
  /** Human decimal amount (e.g. "10.50") — the gateway converts to token base units. */
  amount: string
  token: Address
  payer: Address
  payee: Address
  description?: string
  metadata?: Record<string, unknown>
  /**
   * This payment's identifier in the merchant's own system (e.g. an order, invoice or cart
   * id there), at most 128 characters. Not unique. Both parties read it; it is carried in
   * webhooks, filterable with `list({ reference })`, and an idempotency term.
   */
  reference?: string
  /** The system the reference comes from: a lowercase slug (a-z, 0-9, . _ -), e.g. `commercelayer`. Needs a reference. */
  reference_origin?: string
}
/**
 * Body of PATCH /payments/:id. At least one field (400 otherwise); `null` (or `""`) clears
 * one. Off-chain only: nothing here is signed, so no money moves.
 *
 * - `description`: either party, at most 255 characters.
 * - `merchant_note`: the PAYEE's internal note, at most 2000 characters — never shown to
 *   the payer, not in webhooks (403 `not_the_payee` for the payer).
 * - `reference` / `reference_origin`: the payee corrects the payment's identifier in its
 *   own system (403 `not_the_payee` for the payer); clearing the reference clears its origin.
 */
export interface UpdatePaymentRequest {
  description?: string | null
  merchant_note?: string | null
  reference?: string | null
  reference_origin?: string | null
}
export interface PayerSignatureRequest {
  signature: string
}
export interface SubmitTransactionRequest {
  signed_transaction: string
}
/** Body for the submit-by-hash endpoints (MetaMask reports the broadcast tx hash). */
export interface SubmitByHashRequest {
  transaction_hash: string
}
/** Body for the generic prepare endpoints. amount → capture/refund (human decimal, e.g. "10.50"); signature → refund phase-2; from → release. */
export interface PrepareRequest {
  amount?: string
  signature?: string
  from?: Address
}
/**
 * Adding a wallet requires a SIWE proof-of-ownership of `address`: obtain a
 * single-use nonce from `POST /auth/nonces`, build an EIP-4361 message carrying
 * that nonce whose `address` is the wallet being added, and sign it with THAT
 * wallet's private key. The gateway verifies the signature recovers to
 * `address` (422 otherwise), consumes the nonce, and enforces global address
 * uniqueness (409 if already registered anywhere). The proven address need not
 * equal the session address — a merchant may control several payee wallets.
 *
 * `message`/`signature` are required: adding a wallet is the owner's alone, and
 * an admin cannot add one to another account (the proof is exactly what an operator
 * cannot produce).
 *
 * CURRENTLY UNAVAILABLE: the gateway answers every session 403
 * `wallet_add_unavailable` until the merchant wallet-management section lands; the
 * request shape stays because that section reuses it.
 */
export interface CreateWalletRequest {
  address: string
  /** EIP-4361 SIWE message text signed by the address being added (carries the nonce from POST /auth/nonces). */
  message: string
  /** Signature over the SIWE message (0x…), proving control of the address's private key. */
  signature: string
  label?: string
}
/**
 * Body for `accounts.update`. Every field optional, AT LEAST ONE required — an empty PATCH
 * is a caller bug and the gateway answers 400. name and email are unique across accounts: a
 * value another account already holds is a 409. The account's `active` flag is deliberately
 * absent: it is the operator's field (admin-only), not something an owner can set.
 */
export interface UpdateAccountRequest {
  name?: string
  /** Contact email — where the merchant's operational notifications go. */
  email?: string
  /**
   * Fee setting of the account's own transactions: false switches them to the chain's
   * minimum tip, true back to the suggested priority fee. Owner or admin.
   */
  priority_tip?: boolean
  /**
   * The account's own authorization (capture) window for its NEW payments, in seconds;
   * null puts it back on the gateway default. Within `payment_windows.authorization_ttl`'s
   * min/max. Owner or admin; existing payments keep their signed deadlines.
   */
  authorization_ttl?: number | null
  /**
   * The account's own refund and dispute window for its NEW payments, in seconds; null
   * puts it back on the gateway default. At most `payment_windows.refund_ttl.max`, and
   * the effective pair must keep `refund_ttl - authorization_ttl >= min_refund_window`
   * (422 `invalid_payment_windows` otherwise).
   */
  refund_ttl?: number | null
}
export interface UpdateWalletRequest {
  label?: string
  active?: boolean
}
/**
 * Body for accepting a token (chain) on a wallet. The pair must resolve to an
 * ACTIVE token in the gateway's catalog (422 `unknown_chain` / `unknown_token`
 * otherwise) — a retired token is still readable but can never be advertised.
 */
export interface AddWalletTokenRequest {
  chain_id: number
  /** Token contract address (0x, 40 hex) on `chain_id`. */
  token: Address
  /** Make this the wallet's default token. At most one default per wallet — setting it clears the others. */
  default?: boolean
}
export interface CreateWebhookRequest {
  name: string
  callback_url: string
  /**
   * One subscription, several events. Two subscriptions for the same
   * `callback_url` must not overlap: the gateway answers 409 and names the topic
   * that collided, because delivering one event twice under two different secrets
   * is indistinguishable from a duplicate at the receiving end.
   */
  topics: WebhookTopic[]
}
export interface UpdateWebhookRequest {
  name?: string
  callback_url?: string
  /** REPLACES the set — so this is also how a topic is removed. The secret is untouched. */
  topics?: WebhookTopic[]
}
/**
 * What a webhook's callback did with a test event (`webhooks.test(id)`): `delivered` is
 * the verdict (a 2xx); `response_code` / `response_message` are the endpoint's answer, and
 * `error_reason` says why there was none (a refused address, TLS, a timeout).
 */
export interface WebhookTestResult {
  delivered: boolean
  response_code: string | null
  response_message: string | null
  error_reason: string | null
  duration_ms: number
}
/**
 * Body of POST /payout_destinations: a deposit address at a venue, for the session's own
 * wallet, bound to ONE chain and ONE token.
 *
 * `confirm_details` is REQUIRED and typed as the literal `true`: it records the merchant's
 * statement of the `details_v1` text (`PAYOUT_DETAILS_CONFIRMATION.text`) — "I have checked
 * the address, network, token and minimum deposit on the venue's deposit page and confirm
 * they are correct. Funds sent to a wrong address or network, or below the venue's
 * minimum, may be permanently lost and cannot be recovered by rail0." The SDK never sends
 * it for you: set it only once the merchant has made that check (422
 * `confirmation_required` otherwise).
 */
export interface CreatePayoutDestinationRequest {
  /** The wallet (uuid or address) that will sign transfers to it; must be the session's own. */
  wallet_id: string
  /** The chain the deposit address was issued for. */
  chain_id: number
  /** The token's address on that chain. */
  token: Address
  /** The deposit address, generated at the venue WITH THE NETWORK SET TO THIS CHAIN. */
  address: Address
  label?: string
  /** Defaults to `exchange`. */
  kind?: PayoutDestinationKind
  /**
   * Base units to keep in the wallet on an `all` payout (digits only, below 2^120; 422
   * `invalid_amount` otherwise). Omit for the suggestion (`suggested_reserve`).
   */
  reserve_amount?: Uint256String
  /**
   * The venue's deposit minimum in base units (digits only, below 2^120); omit for none.
   * A payout below it is refused (`payout_below_minimum`) and the proof is raised to it.
   */
  min_amount?: Uint256String
  /** The merchant's confirmation of the `details_v1` text — see above. */
  confirm_details: true
}
/** The fields of a destination PATCH other than the minimum. */
export interface PayoutDestinationEdits {
  label?: string
  /** Base units; an empty string restores the suggestion. */
  reserve_amount?: Uint256String
  /**
   * `false` disables the destination (any wallet of the account may); `true` re-enables
   * it, restoring the verification it had (only the destination's own wallet).
   */
  active?: boolean
}
/**
 * Body of PATCH /payout_destinations/:id.
 *
 * A request that CHANGES `min_amount` (an empty string removes it) needs
 * `confirm_details: true` — the merchant's statement of the `details_v1` text (see
 * `CreatePayoutDestinationRequest`); otherwise 422 `confirmation_required` and nothing is
 * written. The type asks for it whenever `min_amount` is present: the gateway itself
 * waives it for a re-send of the same value. Raising the minimum above the amount of the
 * latest proof takes the verification away (`status` back to `unverified`).
 */
export type UpdatePayoutDestinationRequest =
  | (PayoutDestinationEdits & { min_amount?: undefined; confirm_details?: boolean })
  | (PayoutDestinationEdits & { min_amount: Uint256String; confirm_details: true })
/**
 * Body of POST /payouts/prepare. A `proof` sends the gateway's proof amount
 * (`PAYOUT_PROOF_AMOUNT`, 1 token unit by default), raised to the destination's
 * `min_amount` when that is higher; a `payout` sends `amount` — a human decimal
 * (`"25.50"`) or `"all"` (the wallet's balance minus the refund reserve).
 */
export type PreparePayoutRequest =
  | { destination_id: string; purpose: 'proof' }
  | { destination_id: string; purpose?: 'payout'; amount: string }

// ── Domain models (gateway vocabulary) ───────────────────────────────
/** Condensed payment record (GET /payments list item). */
// Fields always present on a fetched payment are required for ergonomics
// (the gateway serialises them on every read); bookkeeping/nullable fields stay optional.
export interface Payment {
  id?: string
  contract_id?: string
  /**
   * EVM chain id of the payment's deployment. On list rows too, not only on
   * `PaymentDetail`: `amount` is in base units and the token's `decimals` resolve from
   * `token` together with its chain, so a lister without it cannot render an amount.
   */
  chain_id: number
  rail0_id: Bytes32
  status: PaymentStatus
  mode: PaymentMode
  amount: Uint256String
  capturable_amount?: Uint256String
  refundable_amount?: Uint256String
  /**
   * True inside the window after a PARTIAL capture where neither void nor release can
   * return the buyer's remaining escrow — the answer to "why did both just refuse?".
   */
  escrow_stranded?: boolean
  /** When that window ends, ISO-8601; null when the payment is not in it. */
  escrow_returnable_at?: string | null
  config_hash?: Bytes32
  payer: Address
  payee: Address
  token: Address
  /**
   * Decimals of `token`: divide `amount`, `capturable_amount` and `refundable_amount`
   * (base units) by 10^decimals to render them — no `tokens.list()` join on `token` +
   * `chain_id` needed. Resolved by the gateway from its catalogue, retired tokens and
   * archived contract versions included. Null only when the gateway cannot resolve the
   * token; fall back to `tokens.list()` then. Optional so a payment built by hand (a
   * fixture, an older gateway) still type-checks.
   */
  decimals?: number | null
  authorization_expiry: number
  refund_expiry: number
  disputed?: boolean
  /**
   * True while one of the payment's transactions is on its way to the chain: status
   * `submitting`, `submitted`, or `pending` holding its signed transaction (`redrivable`).
   * A pending row still awaiting its signature does not count, nor do confirmed/failed.
   * While true the balances are about to move: disable further actions on the payment and
   * keep polling until it turns false. Carried by list rows too, which embed no transactions.
   */
  in_flight?: boolean
  last_error_code?: string | null
  last_error_message?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
  /** This payment's identifier in the merchant's own system; set at create, correctable by the payee. */
  reference?: string | null
  /** The system the reference comes from, a lowercase slug (e.g. `commercelayer`). */
  reference_origin?: string | null
  /**
   * The payee's internal note. Present only when the session is the payment's PAYEE (and on
   * the operator's full view): a payer's read never carries the key.
   */
  merchant_note?: string | null
  signed_at?: string | null
  created_at: string
  updated_at?: string
}
/** Single-payment view: adds the deployment address, embedded transactions, and (when unsigned) the signing payload. `chain_id` comes from `Payment`. */
export interface PaymentDetail extends Payment {
  rail0_contract?: Address
  transactions?: Transaction[]
  signing_payload?: SigningPayload | null
}
export interface Transaction {
  id: string
  payment_id?: string
  /**
   * The RECORD vocabulary, not the endpoint one: a dispute/close_dispute row comes
   * back from `payments.transactions()` like any other. Typed as
   * TransactionOperation, `tx.operation === 'dispute'` was a TS2367 error for a
   * value that arrives at runtime.
   */
  operation: StoredTransactionOperation
  status: TransactionStatus
  unsigned_transaction?: string | null
  transaction_hash?: string | null
  /** The address that SIGNED the submitted transaction, recovered from the signature by the
   *  gateway at submit — a fact, not a claim. Null where the gateway held no signature to
   *  recover from (a report-by-hash submit, where the wallet broadcast it itself) or where
   *  nothing has been submitted yet. It is what makes a `release` attributable: that
   *  operation is payer-OR-payee, so whose gas it is depends on who signed. */
  sender?: Address | null
  amount?: Uint256String | null
  block_number?: number | null
  /**
   * Whether this transaction's broadcast can be re-enqueued with payments.redrive(): it is
   * "pending" AND the gateway holds its signed bytes — a send that was prepared and signed
   * but never reached the chain. False on a "pending" row with no signature, where the next
   * step is submitting one. The same predicate the redrive route guards on.
   */
  redrivable?: boolean
  /**
   * The decoded failure, null unless status is "failed" — the same code/title/detail triple
   * as an API error body. "error_code" is the machine code (a RAIL0 custom error in
   * snake_case such as "not_payee", a token-level one such as "insufficient_token_balance",
   * or "revert" when the selector is unknown); "error_title" its short label;
   * "error_detail" the sentence to show.
   */
  error_code?: string | null
  error_title?: string | null
  error_detail?: string | null
  /**
   * @deprecated The gateway no longer sends it: read "error_detail" (and "error_title").
   * Kept, always absent, so code still reading it compiles — and gets "undefined", which is
   * what it has been getting since the gateway trimmed the error shape.
   */
  error_message?: string | null
  /** On-chain gas/receipt data, mirrored from the indexer on confirm; null until confirmed. */
  gas_used?: Uint256String | null
  gas_limit?: Uint256String | null
  effective_gas_price?: Uint256String | null
  base_fee_per_gas?: Uint256String | null
  /** Derived (gas_used * effective_gas_price); null until confirmed. */
  gas_cost?: Uint256String | null
  /** Present for refund prepare phase-1: the EIP-3009 payload for the payee to sign. */
  signing_payload?: SigningPayload | null
  pending_at?: string | null
  submitted_at?: string | null
  confirmed_at?: string | null
  created_at?: string
  updated_at?: string
}
export interface Dispute {
  id?: string
  payment_id?: string
  status?: DisputeStatus
  /** On-chain bytes32 open reason, verbatim — the all-zero word when no reason was given; kept even when outside the dictionary. */
  reason?: string
  /** The DisputeOpenReason `reason` reads as; null when no reason was given (zero) or the bytes32 is not in the dictionary. */
  reason_code?: DisputeOpenReason | null
  /** English description of `reason_code`; "No reason given" for the zero bytes32, "Unrecognised reason" for a non-zero bytes32 outside the dictionary. */
  reason_description?: string
  opened_block?: number | null
  opened_at?: string
  closed_by?: 'payer' | 'payee' | null
  /** On-chain bytes32 close reason; the all-zero word when closed with no reason; null while the dispute is open. */
  close_reason?: string | null
  /**
   * The code `close_reason` reads as — a DisputeCloseReason, or the system `full_refund`
   * when a full refund auto-closed the dispute. Null while open, or outside the dictionary.
   */
  close_reason_code?: DisputeCloseReason | DisputeSystemCloseReason | null
  /** English description of `close_reason_code`; "No reason given" for the zero bytes32, "Unrecognised reason" for a non-zero bytes32 outside the dictionary; null while open. */
  close_reason_description?: string | null
  closed_block?: number | null
  closed_at?: string | null
  /** Parent payment (public-safe view), embedded by the account-level GET /disputes list. */
  payment?: Payment
}
/** A merchant account profile (GET/PATCH /accounts/:id). Email is included because those
 *  routes answer only the account's own holder — or an active admin operating it. */
export interface Account {
  id: string
  name: string
  email: string
  /**
   * The fee setting of the account's OWN transactions (authorize, capture, void, release,
   * refund): true (the default) tips the network's suggested priority fee, false uses the
   * chain's minimum tip — 0 on most chains, 25 gwei on Polygon PoS/Amoy. The buyer's
   * dispute/close_dispute never read it.
   */
  priority_tip: boolean
  /**
   * Seconds an authorization of the account's new payments stays capturable: the
   * account's own window, or the gateway default. Optional only for an older gateway.
   */
  authorization_ttl?: number
  /** Seconds the account's new payments stay refundable and disputable: its own, or the default. */
  refund_ttl?: number
  /** Whether each window is the account's own, the defaults, and the bounds a new value must fit. */
  payment_windows?: PaymentWindows
  created_at?: string
  updated_at?: string
}
/**
 * How an account's payment windows are set (Account.payment_windows): per window, whether
 * it is the account's own (`custom`) or the gateway default, the default, and the bounds.
 * The refund window has no floor of its own: the pair must keep
 * `refund_ttl - authorization_ttl >= min_refund_window` (the contract's one-day gap).
 */
export interface PaymentWindows {
  authorization_ttl: { custom: boolean; default: number; min: number; max: number }
  refund_ttl: { custom: boolean; default: number; max: number }
  min_refund_window: number
}
/**
 * A wallet as the merchant-facing routes return it — the gateway's Restricted view, an
 * explicit allow-list of these five fields. It never carries `account_id` or the
 * bookkeeping timestamps; they were typed here once and could only ever read undefined.
 */
export interface Wallet {
  id?: string
  address?: string
  label?: string | null
  active?: boolean
  /**
   * Who switched the wallet off: `owner` (a session signed in with this wallet) or
   * `operator` (an operator session). Null while active, and on a switch-off that
   * predates the record, which the gateway reads as the operator's. It says who may
   * switch the wallet back on: the owner's own session lifts an `owner` switch-off,
   * while an `operator` one is refused to it with 403 `wallet_deactivated_by_operator`.
   */
  deactivated_by?: 'owner' | 'operator' | null
}
export interface WalletTokenHolding {
  /**
   * The token's UUID — the handle for wallets.enableToken/disableToken
   * (PATCH/DELETE …/tokens/:token_id). Without it a client that lists holdings
   * can enable one (addToken upserts by chain+address) but cannot disable it.
   */
  token_id?: string
  token?: Token
  active?: boolean
  default?: boolean
}
/** A wallet with its token holdings nested inline (GET /accounts/:id/wallets). */
export interface WalletWithTokens extends Wallet {
  tokens?: WalletTokenHolding[]
}
export interface Token {
  chain_id?: number
  symbol?: string
  address?: string
  decimals?: number
  /**
   * False for a RETIRED token: still resolvable (a payment references its token
   * address forever, so historical payments must render) but not usable for a
   * new payment. Always present — the gateway marks it required precisely so a
   * `false` is never dropped from the payload.
   */
  active: boolean
}
/**
 * The RAIL0 deployment a NEW payment on a chain is opened against: `address`,
 * `version` (semver) and `deployed_at`. The non-null half of the schema's
 * `ChainContract` — `Blockchain.contract` itself stays nullable/optional.
 */
export type ChainContract = NonNullable<components['schemas']['ChainContract']>
/**
 * A chain as `GET /blockchains` returns it — an ALIAS of the schema component, not a
 * copy. It used to be spelled out field by field here, and so silently lacked
 * `contract` (the RAIL0 deployment per chain) that the gateway sends and the schema
 * types: a hand-written copy only learns about a new field when someone remembers to
 * add it. The alias picks up every future field on regenerate. The one refinement is
 * `settlement`, narrowed to required because the gateway always sends it.
 *
 * Read `required_confirmations` together with `finality_tag`: where the tag is set
 * the gateway gates on it instead, so the number alone describes a wait nobody applies.
 */
export type Blockchain = Omit<components['schemas']['Blockchain'], 'settlement'> & {
  settlement: BlockchainSettlement
}
/**
 * How long an operation on a chain has taken to settle ON THIS GATEWAY — percentiles of
 * broadcast (`submitted_at`) to confirmation (`confirmed_at`) over the confirmed
 * transactions of the trailing `window_days`. End-to-end (chain finality plus the
 * gateway/indexer pipeline), so it is what a client actually waits for.
 *
 * Always present on a `Blockchain` (hence required here, although the schema marks it
 * optional). The percentiles are null below the gateway's minimum sample — `sample_size`
 * says why. Use it as a wait-deadline HINT, not a guarantee: e.g. a small multiple of
 * `p90_seconds`, with a fixed fallback for when it is null.
 */
export type BlockchainSettlement = Required<components['schemas']['BlockchainSettlement']>
export interface AssetBalance {
  symbol?: string
  address?: string | null
  decimals?: number
  raw?: string
  amount?: string
}
export interface BalanceError {
  code?: 'rpc_unavailable' | 'rpc_error' | 'timeout' | 'error'
  message?: string
}
export interface ChainBalance {
  chain_id?: number
  network_type?: string
  native?: AssetBalance
  tokens?: AssetBalance[]
  error?: BalanceError
}
export interface WalletBalances {
  wallet_id?: string
  address?: string
  balances?: ChainBalance[]
}
/** A single-use SIWE nonce (`POST /auth/nonces`). An alias of the schema component —
 *  the hand-written copy it replaces declared fields the gateway never sends
 *  (`id`, `value`, `used`, timestamps) and lacked the `nonce` it does. */
export type Nonce = components['schemas']['Nonce']
/** The raw `POST /auth` body. An alias of the schema component (the copy lacked `name`);
 *  `auth.verify`/`auth.login` return the camel-cased `AuthResponse` instead. */
export type Session = components['schemas']['Session']
export interface Webhook {
  id?: string
  name?: string
  callback_url?: string
  /**
   * Every event this subscription delivers — one shared secret and one circuit breaker
   * for all of them. The delivery names the one that fired in `X-Rail0-Topic`.
   */
  topics?: WebhookTopic[]
  active?: boolean
  circuit_state?: CircuitState
  circuit_failure_count?: number
  created_at?: string
  updated_at?: string
}
/** Webhook view including the shared secret. Returned only on create and rotate_secret. */
export interface WebhookWithSecret extends Webhook {
  shared_secret?: string
}
export interface EventCallback {
  id?: string
  webhook_id?: string
  payment_id?: string
  topic?: string
  callback_url?: string
  response_code?: string | null
  response_message?: string | null
  error_reason?: string | null
  status?: EventCallbackStatus
  created_at?: string
  /** The JSON request body POSTed to the callback URL (decompressed) — for inspection/download. */
  payload?: string | null
}
export interface Health {
  status?: HealthStatus
  api_version?: string
  contract_version?: string
  db?: 'ok' | 'error'
  active_chains?: number
  active_contracts?: number
  timestamp?: string
}

// ── Payouts (merchant cash-out) ──────────────────────────────────────
/**
 * A deposit address at a venue (an exchange, Circle Mint, another wallet) that one of the
 * account's wallets cashes out to — bound to ONE chain and ONE token. An alias of the
 * schema component, with the fields the gateway always sends made required.
 *
 * Amounts are base-unit strings with a `*_formatted` human twin: `reserve_amount` (null =
 * `suggested_reserve`, the refundable balance still inside its refund window, which an
 * `all` payout leaves in the wallet) and `min_amount` (the venue's deposit minimum; null
 * = none).
 */
export type PayoutDestination = components['schemas']['PayoutDestination'] &
  Required<
    Pick<
      components['schemas']['PayoutDestination'],
      'id' | 'wallet_id' | 'chain_id' | 'token' | 'address' | 'kind' | 'status' | 'created_at'
    >
  >
/**
 * One transfer to a payout destination. An alias of the schema component, with the
 * fields the gateway always sends made required.
 *
 * `unsigned_transaction` (while `pending`) is the EIP-1559 ERC-20 `transfer` to sign;
 * BESIDE it are its decoded intent — `chain_id`, `token`, `address` (the recipient) and
 * `amount` (base units) — which `verifyPayoutTransaction` holds the transaction to before
 * any key touches it. `signed: true` on a `pending` row means the gateway stores its
 * signed bytes (and `transaction_hash`): resend it, never re-prepare it.
 */
export type Payout = components['schemas']['Payout'] &
  Required<
    Pick<
      components['schemas']['Payout'],
      | 'id'
      | 'destination_id'
      | 'wallet_id'
      | 'chain_id'
      | 'token'
      | 'address'
      | 'amount'
      | 'purpose'
      | 'status'
      | 'signed'
      | 'created_at'
    >
  >
/** One append-only entry of the payout audit trail (destination and payout events). */
export type PayoutEvent = components['schemas']['PayoutEvent']

// ── Analytics (merchant sales rollups) ───────────────────────────────
/** Volume for one (token, chain). Amounts are token base-unit integer strings
 *  (sums within a single token); format with `decimals`.
 *
 *  BREAKING (was `captured`/`refunded`): those were summed from the full payment
 *  `amount` filtered by status, which is wrong for every partial operation — the
 *  gateway's state machine does not move status on one, so a capture of 30/100 read
 *  as 100 captured and a refund of 40 as 0 refunded. `settled` and `escrowed` come
 *  from the mirrored on-chain residuals and are exact. */
export interface AnalyticsVolume {
  chain_id: number | null
  chain_name: string | null
  token: Address
  symbol: string | null
  decimals: number | null
  orders: number
  /** Value authorized or charged. */
  gross: Uint256String
  /** Value the payee holds, net of refunds (the payment's `refundable_amount`). */
  settled: Uint256String
  /** Value still in escrow — not yet captured nor returned (`capturable_amount`). */
  escrowed: Uint256String
  /** Gross captured, from the confirmed capture transactions. */
  captured: Uint256String
  /** Gross refunded, from the confirmed refund transactions. */
  refunded: Uint256String
}
/** Gas the merchant's own transactions cost on ONE chain, in that chain's NATIVE
 *  token — not the payment token. `spent`/`wasted` are wei-scale base-unit integer
 *  strings and `decimals` is always 18, as it is for every EVM native token.
 *
 *  Per chain and NEVER summed across chains: Base ETH and Polygon POL are different
 *  currencies, the same reason volume is only summed within one token. `wasted` is
 *  gas an on-chain revert burned — money spent for nothing. `confirmed`/`failed` are
 *  resolved transaction counts (`failed_rate` is derived from them).
 *
 *  Covers only the operations the merchant broadcasts: dispute/close_dispute are the
 *  buyer's cost on-chain, and release has no stored sender, so both are excluded. */
export interface AnalyticsGas {
  chain_id: number | null
  chain_name: string | null
  symbol: string | null
  decimals: number | null
  /** Orders behind these figures — the denominator for the average cost of an order.
   *  Counts every payment in scope, INCLUDING those that produced no transaction and
   *  so cost nothing, since leaving them out would average only the expensive ones.
   *  Null on `gas_by_operation`, where one order spans several operations. */
  orders: number | null
  /** Gas that bought a settled operation. */
  spent: Uint256String
  /** Gas an on-chain revert burned. */
  wasted: Uint256String
  confirmed: number
  failed: number
  /** Mean seconds from broadcast to on-chain confirmation for this chain's confirmed
   *  transactions, weighted by their count; null when none confirmed. Per chain because a
   *  chain that wants 60 confirmations and one that wants 4 are not comparable. */
  confirmation_secs: number | null
}
/** One slice of a chain's gas: the same fields as `AnalyticsGas` plus the `key`
 *  naming the slice. Both cuts are the same rows regrouped, so a chain's slices always
 *  add back up to its `AnalyticsGas` row.
 *
 *  A `gas_by_status` key is a payment status and is a SNAPSHOT: status moves, so an
 *  authorize's gas sits under `authorized` until the payment is captured and then
 *  under `captured` — the same period's rows change over time. A `gas_by_operation`
 *  key is an operation and never moves. Show the difference if you render both. */
export interface AnalyticsGasSlice extends AnalyticsGas {
  key: PaymentStatus | TransactionOperation
}

/** One failure code and how many of the merchant's transactions hit it. `code` is the same
 *  catalogue an error body uses; "unknown" when the raw reason decodes to nothing. */
export interface AnalyticsFailure {
  code: string
  transactions: number
}
/** Headline sales KPIs. `by_status` is a status→count map (only present statuses);
 *  `volume` is per (token, chain), only ever summed within a single token; gas is per
 *  chain, in that chain's native token, with the two slices adding back up to it. */
export interface AnalyticsSummary {
  orders: number
  disputed: number
  /** Fraction of orders refunded (0–1, 4 dp). */
  refund_rate: number
  /** Fraction of orders disputed (0–1, 4 dp). */
  dispute_rate: number
  /** Fraction of RESOLVED transactions that failed (0–1, 4 dp) — per TRANSACTION, not
   *  per order: one order can carry several attempts, and a retried capture that
   *  eventually confirms is what this surfaces. */
  failed_rate: number
  by_status: Partial<Record<PaymentStatus, number>>
  /** Why the merchant's transactions failed, commonest first. `failed_rate` says how much
   *  fails; this says what to act on — a revert is a state problem (an amount above the
   *  residual, a closed window), a rejection that never reached the chain is a wallet
   *  problem (no gas money, a used nonce). */
  failures: AnalyticsFailure[]
  volume: AnalyticsVolume[]
  /** Gas per chain, in each chain's native token — never summed across chains. */
  gas: AnalyticsGas[]
  /** The same gas keyed by the payment's CURRENT status (a moving snapshot). */
  gas_by_status: AnalyticsGasSlice[]
  /** The same gas keyed by the operation that paid it — the stable cut. */
  gas_by_operation: AnalyticsGasSlice[]
}
/** One point of the order-count time series (oldest first). `volume` is a
 *  base-unit string only when a single token+chain is filtered, else null. */
export interface AnalyticsBucket {
  /** Bucket start as an ISO-8601 timestamp. */
  bucket: string
  orders: number
  volume: Uint256String | null
}
/** One breakdown row: a dimension key + order count. token/chain rows also carry
 *  token/chain_id/decimals/volume; mode/status rows leave those null. */
export interface AnalyticsRow {
  /** Dimension value: token symbol/address, chain name/id, or the mode/status string. */
  key: string | number
  orders: number
  token?: Address | null
  chain_id?: number | null
  decimals?: number | null
  volume?: Uint256String | null
  /** `operation` rows only: how often the operation RAN. Not the same as `orders` — a
   *  partial capture runs several times on one order. Null on every other dimension. */
  transactions?: number | null
}

// ── Pagination ───────────────────────────────────────────────────────
export interface PageMeta {
  page: number
  per_page: number
  total: number
  /** Pages at this `per_page`. Zero for an empty collection: "no pages" is what there are. */
  total_pages: number
  /**
   * RFC 8288 links off the `Link` header — `first`/`last` always, `prev`/`next` only
   * where they exist, and none at all on an empty collection. The URIs are RELATIVE and
   * resolve against the URL you requested.
   */
  links: { first?: string; prev?: string; next?: string; last?: string }
  /**
   * CURSOR paging only (`payments.list` and `payouts.list` called with `after`, or
   * with `after: ''` to start): the cursor of the next page — pass it back as `after`.
   * Read from the `x-next-cursor` header, else from the `next` link's `after`; absent
   * on the last page, and on every page-number response. A cursor page carries no total,
   * so `total` / `total_pages` only count the page itself there.
   */
  next_cursor?: string
}
export interface PaginatedResponse<T> {
  data: T[]
  meta: PageMeta
}

// ── Error ────────────────────────────────────────────────────────────
/**
 * Exactly what an error body carries now: the gateway trimmed it to these three and
 * DELETED the aliases (`status`, `message`, `error`) rather than dual-sending them —
 * see rail0-gateway#252. `code` is the only discriminator, and it is always present.
 */
export interface ApiErrorBody {
  /** The specific condition and the only field to branch on, e.g. "not_capturable", "insufficient_token_balance". */
  code: string
  /** Short label for the failure, e.g. "Not enough balance". */
  title?: string
  /** One or two sentences fit to show a user verbatim. */
  detail?: string
}
