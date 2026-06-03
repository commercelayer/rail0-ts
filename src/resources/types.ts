// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { components } from '../api.js'

// Re-export raw generated types for advanced use
export type { components, operations } from '../api.js'

// ── Primitive aliases ────────────────────────────────────────────────
/** Checksummed or lowercase Ethereum address (42 chars, 0x-prefixed). */
export type Address = components['schemas']['Address']
/** 32-byte value, hex-encoded (66 chars, 0x-prefixed). */
export type Bytes32 = components['schemas']['Bytes32']
/** Unsigned 256-bit integer serialised as a decimal string. */
export type Uint256String = components['schemas']['Uint256String']

// ── Request body types ───────────────────────────────────────────────
export type CreatePaymentRequest    = components['schemas']['CreatePaymentRequest']
export type CapturePaymentRequest   = components['schemas']['CapturePaymentRequest']
export type PayerSignatureRequest   = components['schemas']['PayerSignatureRequest']
export type SubmitTransactionRequest = components['schemas']['SubmitTransactionRequest']

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

// ── Inline types (not named schemas in the spec) ──────────────────────
export interface Blockchain {
  chain_id: number
  name: string
  slug: string
  network_type: string
  explorer_url: string
}

export interface Token {
  chain_id: number
  chain_slug: string
  symbol: string
  address: string
  decimals: number
}

export interface PaymentMethod {
  id: string
  token_id: string
  chain_id: number
  chain_name: string
  chain_slug: string
  explorer_url: string
  token_address: string
  token_symbol: string
  token_decimals: number
  wallet_address: string
  default: boolean
}

// ── Named response schemas ────────────────────────────────────────────
/** EIP-712 domain for the token contract. */
export interface EIP712Domain {
  name: string
  version: string
  chainId: number
  /** Token contract address. */
  verifyingContract: Address
}

/** Message fields for the EIP-3009 TransferWithAuthorization signature. */
export interface EIP3009Message {
  from: Address
  /** RAIL0 contract address. */
  to: Address
  value: Uint256String
  /** Always '0' for RAIL0 flows. */
  validAfter: Uint256String
  /** Equals authorization_expiry. */
  validBefore: Uint256String
  /** keccak256(NONCE_PREFIX, rail0_id, config_hash). Binds the signature to the exact config and operation type. */
  nonce: Bytes32
}

/** Immutable payment configuration that maps 1-to-1 to the RAIL0 `Payment` Solidity struct. */
export interface PaymentConfig {
  /** Buyer address. Funds are pulled from this address. */
  payer: Address
  /** Account address. Authorized to capture, void, and refund. */
  payee: Address
  /** EIP-3009-capable ERC-20 token address (must be accepted by the RAIL0 deployment). */
  token: Address
  /** Exact amount the payer commits to pay (in token base units). */
  amount: Uint256String
  /** Unix timestamp (seconds). Capture must happen before this; release opens after. */
  authorization_expiry: number
  /** Unix timestamp (seconds). Refund must happen before this. Must be >= authorization_expiry. */
  refund_expiry: number
  /** Fee in basis points (0 = no fee, 10000 = 100%). */
  fee_bps: number
  /** Recipient of the fee on each capture. Use the zero address when fee_bps is 0. */
  fee_receiver: Address
}

/** EIP-712 typed-data structure that the payer (or payee for refund) must sign. Pass verbatim to `eth_signTypedData_v4`. */
export interface SigningPayload {
  domain: EIP712Domain
  types: Record<string, unknown>
  primaryType: string
  message: EIP3009Message
}

export interface CreatePaymentResponse {
  /** Unique identifier for this payment. */
  rail0_id: Bytes32
  /** EIP-712 hash of the Payment struct. Commits the signature to the exact payment terms. */
  config_hash: Bytes32
  payment: PaymentConfig
  chain_id: number
  /** Address of the RAIL0 contract on the target chain. */
  rail0_contract: Address
  signing_payload: SigningPayload
}

export interface PayerSignatureResponse {
  rail0_id: Bytes32
  /** Confirms the signature was accepted and stored. */
  status: string
  /** The address recovered from the signature — should match `payment.payer`. */
  recovered_payer: Address
}

/** An unsigned EIP-1559 transaction ready for the payee to sign. */
export interface PrepareTransactionResponse {
  /** RLP-encoded unsigned EIP-1559 transaction (type 2). */
  unsigned_transaction: string
  /** Server-side Transaction row ID. Passed back in the submit body to link the signed tx to the prepare step. */
  transaction_id: string
  /** Target contract address (informational). */
  to: Address
  /** ABI-encoded calldata (informational). */
  data: string
  chainId: number
  nonce: number
  maxFeePerGas: Uint256String
  maxPriorityFeePerGas: Uint256String
  gasLimit: Uint256String
}

/** Acknowledgement that the transaction has been enqueued. Poll `GET /payments/{rail0_id}` for the final outcome. */
export interface SubmitTransactionAcceptedResponse {
  /** Payment identifier. */
  rail0_id: Bytes32
  /** Always `submitting` — the worker has not yet received the on-chain receipt. */
  status: string
}

/** A wallet token configuration linking a wallet address to a specific token on a chain. */
export interface WalletToken {
  id: string
  wallet_id: string
  address: string
  default: boolean
  active: boolean
  token_id: string
  token_symbol: string
  token_address: string
  token_decimals: number
  chain_id: number
  chain_name: string
  chain_slug: string
}

/** Condensed payment record returned by GET /payments. */
export interface PaymentSummary {
  rail0_id: string
  status: string
  mode: 'authorize' | 'charge'
  amount: string
  payer: string
  payee: string
  token: string
  authorization_expiry: number
  refund_expiry: number
  metadata?: Record<string, unknown> | null
  created_at: string
}

/** An on-chain transaction attempt associated with a payment. */
export interface TransactionRecord {
  id: string
  operation: 'authorize' | 'charge' | 'capture' | 'void' | 'release' | 'refund'
  status: 'pending' | 'submitting' | 'submitted' | 'confirmed' | 'failed'
  transaction_hash?: string | null
  amount?: string | null
  fee_amount: string
  block_number?: number | null
  error_reason?: string | null
  pending_at?: string | null
  submitted_at?: string | null
  confirmed_at?: string | null
}

export interface OnChainState {
  exists: boolean
  capturable_amount: Uint256String
  refundable_amount: Uint256String
}

/** Current state of a payment record. */
export interface GetPaymentResponse {
  rail0_id: Bytes32
  /** Current lifecycle state. */
  status: string
  mode: string
  amount: Uint256String
  payer: Address
  payee: Address
  token: Address
  chain_id: number
  authorization_expiry: number
  refund_expiry: number
  /** Live on-chain amounts. Present when status is authorized, captured, voided, released, charged, or refunded. */
  on_chain?: OnChainState | null
  /** Hash of the most recently broadcast transaction. */
  last_broadcast_hash?: Bytes32
  /** Machine-readable failure reason. Present only when status=failed. */
  failure_code?: string
  /** Human-readable failure description. Present only when status=failed. */
  failure_message?: string
}

/** Union return type for refund prepare (phase 1 returns signing_payload, phase 2 returns PrepareTransactionResponse). */
export type PrepareRefundResponse = PrepareTransactionResponse | { signing_payload: unknown }

// ── Compatibility type aliases ────────────────────────────────────────
export type ReleaseRequest = Record<string, unknown>
export type AuthorizePaymentResponse = SubmitTransactionAcceptedResponse
export type ChargePaymentResponse = SubmitTransactionAcceptedResponse
export type CapturePaymentResponse = SubmitTransactionAcceptedResponse
export type VoidPaymentResponse = SubmitTransactionAcceptedResponse
export type ReleasePaymentResponse = SubmitTransactionAcceptedResponse
export type RefundPaymentResponse = SubmitTransactionAcceptedResponse
export type PaymentResponse = GetPaymentResponse
export type ApiErrorBody = components['schemas']['Error']
export type PaymentMode = 'authorize' | 'charge'
export type SignatureStatus = 'signature_stored'
