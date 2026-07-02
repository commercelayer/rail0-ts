// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.

// Raw generated types for advanced use.
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
export type TransactionOperation = 'authorize' | 'charge' | 'capture' | 'void' | 'release' | 'refund'
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
/** Body for the generic prepare endpoints. amount → capture/refund; signature → refund phase-2; from → release. */
export interface PrepareRequest {
  amount?: string
  signature?: string
  from?: Address
}
export interface CreateWalletRequest {
  address: string
  label?: string
}
export interface UpdateWalletRequest {
  label?: string
  active?: boolean
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
/** Single-payment view: adds chain context, embedded transactions, and (when unsigned) the signing payload. */
export interface PaymentDetail extends Payment {
  chain_id: number
  rail0_contract?: Address
  transactions?: Transaction[]
  signing_payload?: SigningPayload | null
}
export interface Transaction {
  id: string
  payment_id?: string
  operation: TransactionOperation
  status: TransactionStatus
  unsigned_transaction?: string | null
  transaction_hash?: string | null
  amount?: Uint256String | null
  block_number?: number | null
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

/** A (wallet, token, chain) a payee accepts payment on. Client-side convenience (flattened from active wallets), as in rail0-go. */
export interface PaymentMethod {
  address: string
  chain_id: number
  token: Token
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
  status: string
  message?: string
}
