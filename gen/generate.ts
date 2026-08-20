/**
 * Code generation pipeline for the RAIL0 TypeScript SDK.
 *
 * Run with: pnpm generate
 *
 * Steps:
 *   1. Read the OpenAPI schema from the rail0-gateway repo
 *   2. Generate raw TypeScript types via openapi-typescript → src/api.ts
 *   3. Emit src/resources/types.ts — public SDK types (gateway vocabulary)
 *   4. Emit src/resources/{payments,wallets,webhooks,chains,tokens,health}.ts
 *
 * The type vocabulary mirrors the gateway OpenAPI schemas (Payment, PaymentDetail,
 * Transaction, Dispute, Wallet, WalletWithTokens, WalletBalances, Webhook,
 * EventCallback, Health, …), keeping the SDK aligned with rail0-go. The signing
 * types (EIP712Domain / EIP3009Message / PaymentConfig / SigningPayload) are not
 * named in the spec, so they are hand-authored here (as in rail0-go).
 *
 * Schema source (in priority order):
 *   1. RAIL0_SCHEMA_URL env var — remote URL
 *   2. RAIL0_SCHEMA_PATH env var — absolute path to a local openapi.json
 *   3. Default: ../rail0-gateway/docs/openapi.json (sibling repo, the live API)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const genDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(genDir, '..')

const GENERATED_FILE = resolve(root, 'src/api.ts')
const RESOURCES_DIR = resolve(root, 'src/resources')

const FILE_HEADER = '// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.'

function schemaSource(): URL {
  if (process.env.RAIL0_SCHEMA_URL) return new URL(process.env.RAIL0_SCHEMA_URL)
  const localPath =
    process.env.RAIL0_SCHEMA_PATH ?? resolve(root, '..', 'rail0-gateway', 'docs', 'openapi.json')
  return new URL(`file://${localPath}`)
}

// ---------------------------------------------------------------------------
// Step 1 — openapi-typescript → src/api.ts
// ---------------------------------------------------------------------------

async function generateApiTypes(): Promise<void> {
  const url = schemaSource()
  console.log(`Reading schema: ${url}`)
  const ast = await openapiTS(url)
  await mkdir(resolve(root, 'src'), { recursive: true })
  await writeFile(GENERATED_FILE, astToString(ast), 'utf-8')
  console.log(`Generated: ${GENERATED_FILE}`)
}

// ---------------------------------------------------------------------------
// Step 2 — src/resources/types.ts (hand-authored, gateway vocabulary)
// ---------------------------------------------------------------------------

const TYPES = `${FILE_HEADER}

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
 * The six fund operations that have prepare/submit endpoints — the values that
 * can appear in a \`/payments/:id/:operation\` path, and the argument type of
 * prepare/submit/submitByHash.
 *
 * DELIBERATELY NARROWER than what a transaction ROW can hold: see
 * \`StoredTransactionOperation\` for that. The two are genuinely different
 * questions — which endpoints exist, versus which values the stored column can
 * carry — and conflating them is what produced the bug below.
 */
export type TransactionOperation = 'authorize' | 'charge' | 'capture' | 'void' | 'release' | 'refund'
/**
 * Every operation a transaction ROW can carry: the six above plus \`dispute\` and
 * \`close_dispute\`, which have their own payer-only routes rather than living
 * under the generic namespace but mint rows like any other operation.
 *
 * This is the type to compare a row's \`operation\` against, and the type of the
 * \`operation\` filter on \`payments.transactions()\`. It used to be missing, so
 * \`tx.operation === 'dispute'\` was a TS2367 "comparison appears unintentional"
 * for a value that genuinely arrives at runtime, and the row was reachable only
 * through a cast — the gateway spec's \`Transaction.operation\` enum listed only
 * six (commercelayer/rail0-gateway#177, fixed).
 */
export type StoredTransactionOperation =
  NonNullable<components['schemas']['Transaction']['operation']>
export type TransactionStatus = 'pending' | 'submitting' | 'submitted' | 'confirmed' | 'failed'
export type DisputeStatus = 'open' | 'closed'
export type CircuitState = 'closed' | 'open'
export type EventCallbackStatus = 'pending' | 'delivered' | 'failed'
export type HealthStatus = 'ok' | 'degraded'
/** Webhook event topics. Mirrors the gateway's WebhookTopic enum. */
export type WebhookTopic =
  | 'payments.created'
  | 'payments.signed'
  | 'payments.authorized'
  | 'payments.charged'
  | 'payments.captured'
  | 'payments.voided'
  | 'payments.released'
  | 'payments.refunded'
  | 'payments.failed'
  | 'payments.disputed'
  | 'payments.dispute_closed'

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
 * Adding a wallet requires a SIWE proof-of-ownership of \`address\`: obtain a
 * single-use nonce from \`POST /auth/nonces\`, build an EIP-4361 message carrying
 * that nonce whose \`address\` is the wallet being added, and sign it with THAT
 * wallet's private key. The gateway verifies the signature recovers to
 * \`address\` (422 otherwise), consumes the nonce, and enforces global address
 * uniqueness (409 if already registered anywhere). The proven address need not
 * equal the session address — a merchant may control several payee wallets.
 */
export interface CreateWalletRequest {
  address: string
  /** EIP-4361 SIWE message text signed by the address being added (carries the nonce from POST /auth/nonces). */
  message: string
  /** Signature over the SIWE message (0x…), proving control of the address's private key. */
  signature: string
  label?: string
}
export interface UpdateWalletRequest {
  label?: string
  active?: boolean
}
/**
 * Body for accepting a token (chain) on a wallet. The pair must resolve to an
 * ACTIVE token in the gateway's catalog (422 \`unknown_chain\` / \`unknown_token\`
 * otherwise) — a retired token is still readable but can never be advertised.
 */
export interface AddWalletTokenRequest {
  chain_id: number
  /** Token contract address (0x, 40 hex) on \`chain_id\`. */
  token: Address
  /** Make this the wallet's default token. At most one default per wallet — setting it clears the others. */
  default?: boolean
}
export interface CreateWebhookRequest {
  name: string
  callback_url: string
  topic: WebhookTopic
}
export interface UpdateWebhookRequest {
  name?: string
  callback_url?: string
  topic?: WebhookTopic
}

// ── Domain models (gateway vocabulary) ───────────────────────────────
/** Condensed payment record (GET /payments list item). */
// Fields always present on a fetched payment are required for ergonomics
// (the gateway serialises them on every read); bookkeeping/nullable fields stay optional.
export interface Payment {
  id?: string
  contract_id?: string
  /**
   * EVM chain id of the payment's deployment. On list rows too, not only on
   * \`PaymentDetail\`: \`amount\` is in base units and the token's \`decimals\` resolve from
   * \`token\` together with its chain, so a lister without it cannot render an amount.
   */
  chain_id: number
  rail0_id: Bytes32
  status: PaymentStatus
  mode: PaymentMode
  amount: Uint256String
  capturable_amount?: Uint256String
  refundable_amount?: Uint256String
  config_hash?: Bytes32
  payer: Address
  payee: Address
  token: Address
  authorization_expiry: number
  refund_expiry: number
  disputed?: boolean
  last_error_code?: string | null
  last_error_message?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
  signed_at?: string | null
  created_at: string
  updated_at?: string
}
/** Single-payment view: adds the deployment address, embedded transactions, and (when unsigned) the signing payload. \`chain_id\` comes from \`Payment\`. */
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
   * back from \`payments.transactions()\` like any other. Typed as
   * TransactionOperation, \`tx.operation === 'dispute'\` was a TS2367 error for a
   * value that arrives at runtime.
   */
  operation: StoredTransactionOperation
  status: TransactionStatus
  unsigned_transaction?: string | null
  transaction_hash?: string | null
  /** The address that SIGNED the submitted transaction, recovered from the signature by the
   *  gateway at submit — a fact, not a claim. Null where the gateway held no signature to
   *  recover from (a report-by-hash submit, where the wallet broadcast it itself) or where
   *  nothing has been submitted yet. It is what makes a \`release\` attributable: that
   *  operation is payer-OR-payee, so whose gas it is depends on who signed. */
  sender?: Address | null
  amount?: Uint256String | null
  block_number?: number | null
  /** Decoded on-chain failure (null unless status is "failed"): error_code is the RAIL0 custom error in snake_case (e.g. "not_payee"), or "revert" when the selector is unknown; error_message is its human-readable form (e.g. "NotPayee"). */
  error_code?: string | null
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
  reason?: string
  opened_block?: number | null
  opened_at?: string
  closed_by?: 'payer' | 'payee' | null
  close_reason?: string | null
  closed_block?: number | null
  closed_at?: string | null
  /** Parent payment (public-safe view), embedded by the account-level GET /disputes list. */
  payment?: Payment
}
/** A merchant account, as its own holder reads it (GET /accounts/:id). Email is included
 *  because that endpoint is behind an ownership guard — the holder is its only caller. */
export interface Account {
  id: string
  name: string
  email: string
  created_at?: string
  updated_at?: string
}
export interface Wallet {
  id?: string
  account_id?: string
  address?: string
  label?: string | null
  active?: boolean
  created_at?: string
  updated_at?: string
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
   * \`false\` is never dropped from the payload.
   */
  active: boolean
}
export interface Blockchain {
  chain_id?: number
  name?: string
  native_symbol?: string
  network_type?: string
  explorer_url?: string
}
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
export interface Nonce {
  id?: string
  value?: string
  expires_at?: string
  used?: boolean
  created_at?: string
  updated_at?: string
}
export interface Session {
  token?: string
  address?: string
  account_id?: string
  expires_at?: string
}
export interface Webhook {
  id?: string
  name?: string
  callback_url?: string
  topic?: WebhookTopic
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

// ── Analytics (merchant sales rollups) ───────────────────────────────
/** Volume for one (token, chain). Amounts are token base-unit integer strings
 *  (sums within a single token); format with \`decimals\`.
 *
 *  BREAKING (was \`captured\`/\`refunded\`): those were summed from the full payment
 *  \`amount\` filtered by status, which is wrong for every partial operation — the
 *  gateway's state machine does not move status on one, so a capture of 30/100 read
 *  as 100 captured and a refund of 40 as 0 refunded. \`settled\` and \`escrowed\` come
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
  /** Value the payee holds, net of refunds (the payment's \`refundable_amount\`). */
  settled: Uint256String
  /** Value still in escrow — not yet captured nor returned (\`capturable_amount\`). */
  escrowed: Uint256String
  /** Gross captured, from the confirmed capture transactions. */
  captured: Uint256String
  /** Gross refunded, from the confirmed refund transactions. */
  refunded: Uint256String
}
/** Gas the merchant's own transactions cost on ONE chain, in that chain's NATIVE
 *  token — not the payment token. \`spent\`/\`wasted\` are wei-scale base-unit integer
 *  strings and \`decimals\` is always 18, as it is for every EVM native token.
 *
 *  Per chain and NEVER summed across chains: Base ETH and Polygon POL are different
 *  currencies, the same reason volume is only summed within one token. \`wasted\` is
 *  gas an on-chain revert burned — money spent for nothing. \`confirmed\`/\`failed\` are
 *  resolved transaction counts (\`failed_rate\` is derived from them).
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
   *  Null on \`gas_by_operation\`, where one order spans several operations. */
  orders: number | null
  /** Gas that bought a settled operation. */
  spent: Uint256String
  /** Gas an on-chain revert burned. */
  wasted: Uint256String
  confirmed: number
  failed: number
}
/** One slice of a chain's gas: the same fields as \`AnalyticsGas\` plus the \`key\`
 *  naming the slice. Both cuts are the same rows regrouped, so a chain's slices always
 *  add back up to its \`AnalyticsGas\` row.
 *
 *  A \`gas_by_status\` key is a payment status and is a SNAPSHOT: status moves, so an
 *  authorize's gas sits under \`authorized\` until the payment is captured and then
 *  under \`captured\` — the same period's rows change over time. A \`gas_by_operation\`
 *  key is an operation and never moves. Show the difference if you render both. */
export interface AnalyticsGasSlice extends AnalyticsGas {
  key: PaymentStatus | TransactionOperation
}

/** Headline sales KPIs. \`by_status\` is a status→count map (only present statuses);
 *  \`volume\` is per (token, chain), only ever summed within a single token; gas is per
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
  volume: AnalyticsVolume[]
  /** Gas per chain, in each chain's native token — never summed across chains. */
  gas: AnalyticsGas[]
  /** The same gas keyed by the payment's CURRENT status (a moving snapshot). */
  gas_by_status: AnalyticsGasSlice[]
  /** The same gas keyed by the operation that paid it — the stable cut. */
  gas_by_operation: AnalyticsGasSlice[]
}
/** One point of the order-count time series (oldest first). \`volume\` is a
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
}

// ── Pagination ───────────────────────────────────────────────────────
export interface PageMeta {
  page: number
  per_page: number
  total: number
}
export interface PaginatedResponse<T> {
  data: T[]
  meta: PageMeta
}

// ── Error ────────────────────────────────────────────────────────────
export interface ApiErrorBody {
  /** The specific condition and the only field to branch on, e.g. "not_capturable", "insufficient_token_balance". */
  code?: string
  /** Short label for the failure, e.g. "Not enough balance". */
  title?: string
  /** One or two sentences fit to show a user verbatim. */
  detail?: string
  /** The wider family the code sits in (e.g. "forbidden", "invalid_state"), under its pre-code/title/detail name. Also the code itself on errors with no wider family. */
  status: string
  /** Legacy alias of detail. */
  message?: string
  /** The specific sub-code under its older name, sent on invalid_state and contract_revert responses. */
  error?: string
}
`

// ---------------------------------------------------------------------------
// Step 3 — Resource files
// ---------------------------------------------------------------------------

const BUILD_QUERY = `
function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return \`?\${entries.map(([k, v]) => \`\${k}=\${encodeURIComponent(String(v))}\`).join('&')}\`
}
`

const PAYMENTS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type {
  Bytes32,
  CreatePaymentRequest,
  Dispute,
  DisputeStatus,
  PaginatedResponse,
  Payment,
  PaymentDetail,
  PaymentMode,
  PaymentStatus,
  PayerSignatureRequest,
  PrepareRequest,
  SubmitByHashRequest,
  SubmitTransactionRequest,
  Transaction,
  TransactionOperation,
  TransactionStatus,
  StoredTransactionOperation,
} from './types.js'

// The gateway validates these filters with Grape \`values:\` and answers 400 on
// anything else, so they are typed as the unions rather than bare strings —
// \`list({ status: 'cancelled' })\` is a compile error, not a runtime 400.
export interface ListPaymentsParams {
  status?: PaymentStatus
  mode?: PaymentMode
  payer?: string
  payee?: string
  token?: string
  /** Filter by EVM chain id. */
  chain_id?: number
  /** Filter by whether an open dispute exists (tri-state: omit for either). */
  disputed?: boolean
  /** Minimum amount in token base units (inclusive). */
  min_amount?: string
  /** Maximum amount in token base units (inclusive). */
  max_amount?: string
  /** Only payments created at/after this ISO-8601 timestamp. */
  created_from?: string
  /** Only payments created at/before this ISO-8601 timestamp. */
  created_to?: string
  rail0_id?: string
  sort?: string
  page?: number
  per_page?: number
}

export interface ListTransactionsParams {
  /**
   * Filter by operation. Typed as the RECORD vocabulary, not the endpoint one: the
   * gateway accepts all eight stored operations here, so \`?operation=dispute\` —
   * the very filter rail0-cli#47 was fixed to allow — must type-check. It was
   * \`string\` while the spec's record enum was missing those two values
   * (commercelayer/rail0-gateway#177, fixed).
   */
  operation?: StoredTransactionOperation
  status?: TransactionStatus
  sort?: string
  page?: number
  per_page?: number
}

export interface ListDisputesParams {
  /** Filter by dispute status ("open" or "closed"). */
  status?: DisputeStatus
  sort?: string
  page?: number
  per_page?: number
}

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a payment. Returns the PaymentDetail, including the EIP-712 signing_payload for the payer.
   *
   * Pass \`idempotencyKey\` to make the request replay-safe: a repeated call with
   * the same key returns the existing payment (HTTP 200) instead of creating a new one.
   */
  create(params: CreatePaymentRequest, idempotencyKey?: string): Promise<PaymentDetail> {
    return this.http.post('/payments', params, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined)
  }

  /** List payments for the authenticated wallet (payer or payee). Requires a JWT. */
  list(params?: ListPaymentsParams): Promise<PaginatedResponse<Payment>> {
    return this.http.getPaginated(\`/payments\${buildQuery(params)}\`)
  }

  /** Fetch a payment's current state (DB status + live on-chain balances + transactions). */
  get(id: Bytes32): Promise<PaymentDetail> {
    return this.http.get(\`/payments/\${id}\`)
  }

  /** List a payment's on-chain transactions. */
  transactions(id: Bytes32, params?: ListTransactionsParams): Promise<PaginatedResponse<Transaction>> {
    return this.http.getPaginated(\`/payments/\${id}/transactions\${buildQuery(params)}\`)
  }

  /** Store the payer's EIP-3009 signature (moves the payment to \`signed\`). */
  sign(id: Bytes32, params: PayerSignatureRequest): Promise<PaymentDetail> {
    return this.http.put(\`/payments/\${id}/sign\`, params)
  }

  /** List the payment's dispute open/close history (paginated). */
  disputes(id: Bytes32, params?: ListDisputesParams): Promise<PaginatedResponse<Dispute>> {
    return this.http.getPaginated(\`/payments/\${id}/disputes\${buildQuery(params)}\`)
  }

  // ── Generic prepare/submit ─────────────────────────────────────────
  // For the standard operations only (authorize/capture/charge/void/release/
  // refund). Dispute and close-dispute have their own paths (dispute/prepare and
  // dispute/close/prepare) — use disputePrepare/dispute and closeDisputePrepare/
  // closeDispute, not this generic form.
  /** Build the unsigned transaction for an operation. */
  prepare(id: Bytes32, operation: TransactionOperation, body?: PrepareRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/\${operation}/prepare\`, body)
  }

  /** Broadcast a signed transaction for an operation (HTTP 202, async). */
  submit(id: Bytes32, operation: TransactionOperation, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/\${operation}\`, params)
  }

  /** Record an already-broadcast transaction by hash (MetaMask signs+broadcasts in one step).
   *  Payee-only for the merchant operations; \`release\` is authorized for either participant
   *  (payer or payee). The payer operations dispute/close-dispute have their own payer-only
   *  report-by-hash methods below (disputeSubmitByHash / closeDisputeSubmitByHash). */
  submitByHash(id: Bytes32, operation: TransactionOperation, params: SubmitByHashRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/\${operation}/submitted\`, params)
  }

  // ── Operation-specific pairs (payee unless noted) ──────────────────
  authorizePrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/authorize/prepare\`)
  }
  authorize(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/authorize\`, params)
  }

  chargePrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/charge/prepare\`)
  }
  charge(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/charge\`, params)
  }

  /** \`amount\` is a human decimal (e.g. "10.50") — the gateway converts to token base units. */
  capturePrepare(id: Bytes32, amount: string): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/capture/prepare\`, { amount })
  }
  capture(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/capture\`, params)
  }

  voidPrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/void/prepare\`)
  }
  void(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/void\`, params)
  }

  /** Release an expired escrow (permissionless). \`from\` defaults to the payer. */
  releasePrepare(id: Bytes32, from?: string): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/release/prepare\`, from ? { from } : undefined)
  }
  release(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/release\`, params)
  }

  /**
   * Refund prepare — two-phase EIP-3009 flow.
   * Phase 1: \`{ amount }\` → Transaction carrying a signing_payload for the payee to sign.
   * Phase 2: \`{ amount, signature }\` → the unsigned on-chain refund transaction.
   */
  refundPrepare(id: Bytes32, body: PrepareRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/refund/prepare\`, body)
  }
  refund(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/refund\`, params)
  }

  /** Open a dispute (payer, signal-only). Optional bytes32 reason code. */
  disputePrepare(id: Bytes32, reason?: string): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute/prepare\`, reason ? { reason } : undefined)
  }
  dispute(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute\`, params)
  }

  /** Close a dispute (payer). Optional bytes32 reason code. */
  closeDisputePrepare(id: Bytes32, reason?: string): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute/close/prepare\`, reason ? { reason } : undefined)
  }
  closeDispute(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute/close\`, params)
  }

  /** Report an already-broadcast dispute tx by hash (MetaMask buyer flow). Payer-only:
   *  the payer authenticates account-less via SIWE, since the bare hash carries no
   *  signature. The payer's counterpart to submitByHash. */
  disputeSubmitByHash(id: Bytes32, params: SubmitByHashRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute/submitted\`, params)
  }

  /** Report an already-broadcast close-dispute tx by hash (MetaMask buyer flow). Payer-only. */
  closeDisputeSubmitByHash(id: Bytes32, params: SubmitByHashRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute/close/submitted\`, params)
  }
}
${BUILD_QUERY}`

const ACCOUNTS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { Account } from './types.js'

/**
 * The merchant account itself (GET /accounts/:id).
 *
 * Behind SIWE and behind an ownership guard: the gateway requires a JWT whose account
 * matches the path, so this only ever reads the caller's OWN account — there is no
 * endpoint here for reading someone else's, by design. An id that is not an account
 * answers 404, the same shape the ownership guard gives for another account's id, so the
 * pair cannot be used to tell whether an account exists.
 *
 * The account's wallets live on WalletsResource (they are a collection under the same
 * path), and buyer-facing discovery on PaymentMethodsResource.
 */
export class AccountsResource {
  constructor(private readonly http: HttpClient) {}

  /** The account's own profile: id, name, email, timestamps. */
  get(account_id: string): Promise<Account> {
    return this.http.get(\`/accounts/\${account_id}\`)
  }
}
`

const WALLETS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type {
  AddWalletTokenRequest,
  CreateWalletRequest,
  PaginatedResponse,
  UpdateWalletRequest,
  Wallet,
  WalletBalances,
  WalletTokenHolding,
  WalletWithTokens,
} from './types.js'

export interface ListWalletsParams {
  chain_id?: number
  token_symbol?: string
  active?: boolean
  /** Restrict nested token holdings to the default one. */
  default?: boolean
  sort?: string
  page?: number
  per_page?: number
}

export interface WalletBalancesParams {
  chain_id?: number
  token_symbol?: string
}

/**
 * Wallets and their token holdings, scoped to an account. Mirrors rail0-go's
 * WalletsService. Every method is behind SIWE — a merchant manages its OWN
 * wallets here. Public, buyer-facing discovery of a merchant's accepted
 * wallets/tokens lives on PaymentMethodsResource (GET /payment_methods).
 */
export class WalletsResource {
  constructor(private readonly http: HttpClient) {}

  /** List an account's wallets, each with its token holdings nested. */
  list(account_id: string, params?: ListWalletsParams): Promise<PaginatedResponse<WalletWithTokens>> {
    return this.http.getPaginated(\`/accounts/\${account_id}/wallets\${buildQuery(params)}\`)
  }

  /** Fetch a single wallet by UUID or 0x address. */
  get(account_id: string, id_or_address: string): Promise<Wallet> {
    return this.http.get(\`/accounts/\${account_id}/wallets/\${id_or_address}\`)
  }

  /**
   * Add a wallet to the account. Requires a SIWE proof-of-ownership of the
   * address being added: pass the EIP-4361 \`message\` (nonce from
   * \`POST /auth/nonces\`) and its \`signature\`, produced with the added wallet's
   * own key — see CreateWalletRequest. The gateway rejects a signature that does
   * not recover to \`address\` (422) and an address already registered anywhere (409).
   */
  create(account_id: string, params: CreateWalletRequest): Promise<Wallet> {
    return this.http.post(\`/accounts/\${account_id}/wallets\`, params)
  }

  /** Update a wallet's label or active flag. */
  update(account_id: string, id: string, params: UpdateWalletRequest): Promise<Wallet> {
    return this.http.patch(\`/accounts/\${account_id}/wallets/\${id}\`, params)
  }

  /** Soft-delete (deactivate) a wallet. */
  delete(account_id: string, id: string): Promise<void> {
    return this.http.delete(\`/accounts/\${account_id}/wallets/\${id}\`)
  }

  /** Read a wallet's live on-chain balances (native + tokens). */
  balances(account_id: string, id: string, params?: WalletBalancesParams): Promise<WalletBalances> {
    return this.http.get(\`/accounts/\${account_id}/wallets/\${id}/balances\${buildQuery(params)}\`)
  }

  // ── Accepted tokens ────────────────────────────────────────────────
  // The (wallet, token) holdings that power the public GET /payment_methods and
  // gate payment creation: POST /payments refuses a payee/token pair the wallet
  // does not accept (422 unsupported_payment_method), so onboarding a merchant is
  // wallets.create + at least one addToken — a wallet with no holding is invisible
  // to buyers and unusable as a payee.
  //
  // \`token_id\` on remove/enable/disable is the TOKEN's UUID (as returned in
  // WalletTokenHolding.token), NOT an id of the holding row — the gateway looks
  // the holding up by (wallet, token). A non-UUID is a clean 404.

  /**
   * Accept a token (chain) on this wallet — an upsert on (wallet, token): a
   * previously-disabled holding is reactivated rather than duplicated. The
   * gateway answers 201 when it creates the holding and 200 when it reactivates
   * or updates one; both return the holding, so the SDK does not distinguish them.
   */
  addToken(account_id: string, id: string, params: AddWalletTokenRequest): Promise<WalletTokenHolding> {
    return this.http.post(\`/accounts/\${account_id}/wallets/\${id}/tokens\`, params)
  }

  /**
   * Stop accepting a token — soft delete (204). The holding row survives with
   * active:false (and loses \`default\`), so its history is kept and enableToken
   * can bring it back.
   */
  removeToken(account_id: string, id: string, token_id: string): Promise<void> {
    return this.http.delete(\`/accounts/\${account_id}/wallets/\${id}/tokens/\${token_id}\`)
  }

  /** Re-enable an EXISTING holding. 404 when the wallet has none for the token — use addToken to create one. */
  enableToken(account_id: string, id: string, token_id: string): Promise<WalletTokenHolding> {
    return this.http.patch(\`/accounts/\${account_id}/wallets/\${id}/tokens/\${token_id}/enable\`)
  }

  /** Disable an EXISTING holding (same effect as removeToken, but returns the holding). 404 when absent. */
  disableToken(account_id: string, id: string, token_id: string): Promise<WalletTokenHolding> {
    return this.http.patch(\`/accounts/\${account_id}/wallets/\${id}/tokens/\${token_id}/disable\`)
  }
}
${BUILD_QUERY}`

const PAYMENT_METHODS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { WalletWithTokens } from './types.js'

/**
 * Selects the merchant whose payment methods to list. Provide EXACTLY ONE:
 * account_id returns all the merchant's active wallets; address returns just
 * that one wallet. Both empty (or both set) is rejected by the gateway (400).
 */
export interface PaymentMethodsQuery {
  account_id?: string
  address?: string
}

/**
 * Public, buyer-facing discovery of a merchant's accepted payment methods
 * (GET /payment_methods). Unlike WalletsResource (behind SIWE), this needs no
 * JWT: a payer that only knows the merchant — by account id, or by one of its
 * wallet addresses — lists the active wallet/token combinations it accepts.
 */
export class PaymentMethodsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the merchant's active wallets, each with its active token holdings
   * nested under \`tokens\` (WalletWithTokens) — the same wallet-centric shape as
   * WalletsResource.list, but public and scoped by the query. An unknown
   * account/address yields an empty array. No pagination.
   */
  list(query: PaymentMethodsQuery): Promise<WalletWithTokens[]> {
    return this.http.get(\`/payment_methods\${buildQuery(query)}\`)
  }
}
${BUILD_QUERY}`

const WEBHOOKS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type {
  CreateWebhookRequest,
  EventCallback,
  PaginatedResponse,
  UpdateWebhookRequest,
  Webhook,
  WebhookWithSecret,
} from './types.js'

export interface ListWebhooksParams {
  topic?: string
  active?: boolean
  circuit_state?: 'closed' | 'open'
  sort?: string
  page?: number
  per_page?: number
}

export interface ListEventCallbacksParams {
  status?: 'pending' | 'delivered' | 'failed'
  sort?: string
  page?: number
  per_page?: number
}

/** Webhook subscriptions for the authenticated account. All methods require a JWT. */
export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  list(params?: ListWebhooksParams): Promise<PaginatedResponse<Webhook>> {
    return this.http.getPaginated(\`/webhooks\${buildQuery(params)}\`)
  }

  /** Register a webhook. The response includes the shared_secret — shown only here and on rotateSecret. */
  create(params: CreateWebhookRequest): Promise<WebhookWithSecret> {
    return this.http.post('/webhooks', params)
  }

  get(id: string): Promise<Webhook> {
    return this.http.get(\`/webhooks/\${id}\`)
  }

  update(id: string, params: UpdateWebhookRequest): Promise<Webhook> {
    return this.http.patch(\`/webhooks/\${id}\`, params)
  }

  enable(id: string): Promise<Webhook> {
    return this.http.put(\`/webhooks/\${id}/enable\`)
  }

  disable(id: string): Promise<Webhook> {
    return this.http.put(\`/webhooks/\${id}/disable\`)
  }

  /** Rotate the shared secret — returned once in the response. */
  rotateSecret(id: string): Promise<WebhookWithSecret> {
    return this.http.put(\`/webhooks/\${id}/rotate_secret\`)
  }

  /** Reset the delivery circuit breaker and re-enable the webhook. */
  resetCircuit(id: string): Promise<Webhook> {
    return this.http.put(\`/webhooks/\${id}/reset_circuit\`)
  }

  /** List delivery attempts for a webhook. */
  eventCallbacks(id: string, params?: ListEventCallbacksParams): Promise<PaginatedResponse<EventCallback>> {
    return this.http.getPaginated(\`/webhooks/\${id}/event_callbacks\${buildQuery(params)}\`)
  }

  delete(id: string): Promise<void> {
    return this.http.delete(\`/webhooks/\${id}\`)
  }
}
${BUILD_QUERY}`

const CHAINS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { Blockchain } from './types.js'

export type { Blockchain } from './types.js'

export interface ListChainsParams {
  /** Filter by network type ("testnet" or "mainnet"). */
  network_type?: string
  /** Filter by native symbol (case-insensitive, e.g. "ETH"). */
  symbol?: string
}

export class ChainsResource {
  constructor(private readonly http: HttpClient) {}

  /** List active blockchains supported by RAIL0, optionally filtered. */
  list(params?: ListChainsParams): Promise<Blockchain[]> {
    return this.http.get(\`/blockchains\${buildQuery(params)}\`)
  }
}
${BUILD_QUERY}`

const TOKENS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { Token } from './types.js'

export type { Token } from './types.js'

export class TokensResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List tokens, optionally filtered by chain, symbol and/or active flag.
   *
   * Returns EVERY token by default, retired ones included — a payment references
   * its token address forever, so resolving a historical payment needs them, and
   * each carries \`active\`. Pass \`active: true\` on a path that must only offer
   * what a NEW payment can use.
   *
   * @param chain_id Chain ID to filter by. Omit or 0 for all chains.
   * @param symbol   Token symbol to filter by (case-insensitive, e.g. "USDC").
   * @param active   Filter by active flag; omit for every token.
   */
  list(chain_id?: number, symbol?: string, active?: boolean): Promise<Token[]> {
    return this.http.get(\`/tokens\${buildQuery({ chain_id: chain_id || undefined, symbol, active })}\`)
  }
}
${BUILD_QUERY}`

const DISPUTES = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { Dispute, PaginatedResponse } from './types.js'
import type { ListDisputesParams } from './payments.js'

/**
 * Account-level dispute list (requires JWT). Complements
 * PaymentsResource.disputes (one payment's open/close history): this surfaces
 * every dispute — open AND closed — across the caller's payments (as payer or
 * payee), each with its parent \`payment\` embedded. A closed dispute drops out
 * of the \`disputed\` filter on PaymentsResource.list (current-state) but still
 * appears here.
 */
export class DisputesResource {
  constructor(private readonly http: HttpClient) {}

  /** List the account's disputes (open and closed). */
  list(params?: ListDisputesParams): Promise<PaginatedResponse<Dispute>> {
    return this.http.getPaginated(\`/disputes\${buildQuery(params)}\`)
  }
}
${BUILD_QUERY}`

const ANALYTICS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type {
  Address,
  AnalyticsBucket,
  AnalyticsRow,
  AnalyticsSummary,
  PaymentMode,
  PaymentStatus,
} from './types.js'

/**
 * Shared query filters for every analytics endpoint. All optional; each narrows
 * the account's own payments (as payee). \`token\` + \`chain_id\` together scope
 * monetary volume to a single token, so sums never mix tokens/decimals.
 */
export interface AnalyticsFilters {
  mode?: PaymentMode
  status?: PaymentStatus
  /** Token address (0x…) — scopes volume to one token. */
  token?: Address
  chain_id?: number
  /** Only payments created at/after this ISO-8601 timestamp. */
  from?: string
  /** Only payments created at/before this ISO-8601 timestamp. */
  to?: string
}

/** Time-bucket granularity for the timeseries endpoint (gateway default: "day"). */
export type AnalyticsInterval = 'day' | 'week' | 'month'
/** Dimension to aggregate by for the breakdown endpoint. */
export type AnalyticsDimension = 'token' | 'chain' | 'mode' | 'status'

/**
 * Merchant sales analytics (GET /analytics/*). Account-scoped and account-ONLY:
 * every endpoint needs a JWT with a non-null account — 401 without a token, 403
 * for an account-less (buyer) session. Results cover only the account's own
 * payments as payee, so a merchant only ever sees its own sales. Mirrors the
 * gateway's Analytics service rollups.
 */
export class AnalyticsResource {
  constructor(private readonly http: HttpClient) {}

  /** Headline KPIs: order counts, by-status counts, refund/dispute/failed rates, per-(token, chain) volume, and per-chain gas (also sliced by status and by operation). */
  summary(filters?: AnalyticsFilters): Promise<AnalyticsSummary> {
    return this.http.get(\`/analytics/summary\${buildQuery(filters)}\`)
  }

  /** Order count per time bucket (oldest first); single-token volume only when both token and chain are filtered. */
  timeseries(
    filters?: AnalyticsFilters,
    options?: { interval?: AnalyticsInterval },
  ): Promise<AnalyticsBucket[]> {
    return this.http.get(\`/analytics/timeseries\${buildQuery({ ...filters, interval: options?.interval })}\`)
  }

  /** Aggregate orders by a dimension. token/chain rows carry per-token volume; mode/status are counts only. */
  breakdown(
    filters: AnalyticsFilters | undefined,
    options: { by: AnalyticsDimension },
  ): Promise<AnalyticsRow[]> {
    return this.http.get(\`/analytics/breakdown\${buildQuery({ ...filters, by: options.by })}\`)
  }
}
${BUILD_QUERY}`

const HEALTH = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { Health } from './types.js'

export type { Health } from './types.js'

export class HealthResource {
  constructor(private readonly http: HttpClient) {}

  /** Report gateway liveness/readiness (DB, chain/contract counts). */
  get(): Promise<Health> {
    return this.http.get('/health')
  }
}
`

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function writeResource(name: string, content: string): Promise<void> {
  const outPath = resolve(RESOURCES_DIR, name)
  await writeFile(outPath, content, 'utf-8')
  console.log(`Generated: ${outPath}`)
}

await generateApiTypes()
await mkdir(RESOURCES_DIR, { recursive: true })
await writeFile(resolve(RESOURCES_DIR, 'types.ts'), TYPES, 'utf-8')
console.log(`Generated: ${resolve(RESOURCES_DIR, 'types.ts')}`)
await writeResource('accounts.ts', ACCOUNTS)
await writeResource('payments.ts', PAYMENTS)
await writeResource('disputes.ts', DISPUTES)
await writeResource('wallets.ts', WALLETS)
await writeResource('payment_methods.ts', PAYMENT_METHODS)
await writeResource('webhooks.ts', WEBHOOKS)
await writeResource('chains.ts', CHAINS)
await writeResource('tokens.ts', TOKENS)
await writeResource('analytics.ts', ANALYTICS)
await writeResource('health.ts', HEALTH)

console.log('Done.')
