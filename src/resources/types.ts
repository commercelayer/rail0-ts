/**
 * Public types for the RAIL0 SDK.
 *
 * All types are derived from the generated OpenAPI schema in ../api.ts.
 * Do not add hand-written types here — extend the OpenAPI spec instead,
 * then re-run `pnpm generate`.
 */
import type { components, operations } from '../api.js'

// ================================================================
//  Re-export generated internals for advanced use
// ================================================================

export type { components, operations } from '../api.js'

// ================================================================
//  Primitive aliases
// ================================================================

/** Checksummed or lowercase Ethereum address (42 chars, 0x-prefixed). */
export type Address = components['schemas']['Address']

/** 32-byte value, hex-encoded (66 chars, 0x-prefixed). Used for payment IDs, hashes, and signature components. */
export type Bytes32 = components['schemas']['Bytes32']

/**
 * Unsigned 256-bit integer serialised as a decimal string.
 * Avoids precision loss when amounts exceed `Number.MAX_SAFE_INTEGER`.
 */
export type Uint256String = components['schemas']['Uint256String']

// ================================================================
//  Core models
// ================================================================

/**
 * Immutable payment configuration shared by both payer and payee.
 *
 * The EIP-712 digest (`configHash`) is committed on-chain the first time
 * `authorize` or `charge` is called. Every subsequent operation on the same
 * `paymentId` must supply the exact same struct — a mismatch causes the
 * contract to revert with `PaymentMismatch`.
 */
export type PaymentConfig = components['schemas']['PaymentConfig']

/** EIP-712 domain for the token contract (used by EIP-3009 TransferWithAuthorization). */
export type EIP712Domain = components['schemas']['EIP712Domain']

/** Message fields for the EIP-3009 TransferWithAuthorization typed-data signature. */
export type EIP3009Message = components['schemas']['EIP3009Message']

/**
 * EIP-712 typed-data structure returned by `POST /payments`.
 * Pass verbatim to `eth_signTypedData_v4`, or compute the digest manually
 * with any EIP-712 library and sign with secp256k1.
 */
export type SigningPayload = components['schemas']['SigningPayload']

// ================================================================
//  Request bodies
// ================================================================

/** Body for `payments.createPayment()`. */
export type CreatePaymentRequest = components['schemas']['CreatePaymentRequest']

/** Body for `payments.sign()`. EIP-712 signature components (v, r, s). */
export type PayerSignatureRequest = components['schemas']['PayerSignatureRequest']

/** Body for `payments.prepareCapture()`. Amount to capture from escrow. */
export type CapturePaymentRequest = components['schemas']['CapturePaymentRequest']

/** Body for `payments.submitCapture()`, `submitVoid()`, `submitApprove()`, `submitRefund()`. */
export type SubmitTransactionRequest = components['schemas']['SubmitTransactionRequest']

/** Body for `payments.prepareApprove()`. Allowance to grant the RAIL0 contract. */
export type ApproveRequest = components['schemas']['ApproveRequest']

/** Body for `payments.prepareRefund()`. Amount to refund to the payer. */
export type RefundPaymentRequest = components['schemas']['RefundPaymentRequest']

// ================================================================
//  Response shapes
// ================================================================

/** Returned by `payments.createPayment()`. Contains the paymentId and the EIP-712 signingPayload. */
export type CreatePaymentResponse = components['schemas']['CreatePaymentResponse']

/** Returned by `payments.sign()`. Confirms the signature was stored. */
export type PayerSignatureResponse = components['schemas']['PayerSignatureResponse']

/** Returned by `payments.authorize()`. Contains the on-chain tx hash and capturableAmount. */
export type AuthorizePaymentResponse = components['schemas']['AuthorizePaymentResponse']

/** Returned by `payments.charge()`. Contains the on-chain tx hash and amounts. */
export type ChargePaymentResponse = components['schemas']['ChargePaymentResponse']

/**
 * Returned by prepare operations (prepareCapture, prepareVoid, prepareApprove, prepareRefund).
 * An unsigned EIP-1559 transaction ready for the payee to sign.
 */
export type PrepareTransactionResponse = components['schemas']['PrepareTransactionResponse']

/** Returned by `payments.submitCapture()`. Contains amounts and updated escrow balances. */
export type CapturePaymentResponse = components['schemas']['CapturePaymentResponse']

/** Returned by `payments.submitVoid()`. Contains the on-chain tx hash and released amount. */
export type VoidPaymentResponse = components['schemas']['VoidPaymentResponse']

/** Returned by `payments.release()`. Contains the on-chain tx hash and released amount. */
export type ReleasePaymentResponse = components['schemas']['ReleasePaymentResponse']

/** Returned by `payments.submitApprove()`. Contains the on-chain tx hash and approval details. */
export type ApproveResponse = components['schemas']['ApproveResponse']

/** Returned by `payments.submitRefund()`. Contains the on-chain tx hash and refunded amount. */
export type RefundPaymentResponse = components['schemas']['RefundPaymentResponse']

// ================================================================
//  Error
// ================================================================

/**
 * Shape of error responses from the RAIL0 API.
 * Also exposed as properties on `Rail0ApiError` instances.
 */
export type ApiErrorBody = components['schemas']['Error']

// ================================================================
//  Hand-written extension types
// ================================================================

/** Body for `payments.prepareRelease()`. Pass callerAddress to build the tx for the buyer. */
export type ReleaseRequest = { callerAddress?: Address }

/** Body for `payments.submitApprove()`. Include amount so the API records it in the transaction log. */
export type SubmitApproveRequest = SubmitTransactionRequest & { amount?: Uint256String }

/** Live on-chain escrow state for a payment. */
export interface OnChainState {
  exists: boolean
  capturableAmount: Uint256String
  refundableAmount: Uint256String
}

/** Returned by `payments.get()`. Combines DB status with live on-chain balances. */
export interface PaymentResponse {
  paymentId: Bytes32
  status: string
  mode: string
  amount: Uint256String
  payer: Address
  payee: Address
  token: Address
  chainId: number
  authorizationExpiry: number
  refundExpiry: number
  onChain?: OnChainState
}

/** A single accepted payment method for a merchant (chain + token + wallet). */
export interface PaymentMethod {
  id: number
  tokenId: number
  chainId: number
  chainName: string
  chainSlug: string
  explorerUrl: string
  tokenAddress: Address
  tokenSymbol: string
  tokenDecimals: number
  walletAddress: Address
  isDefault: boolean
}

// ================================================================
//  Derived utility types
// ================================================================

/** `"authorize" | "charge"` — payment mode set at creation time. */
export type PaymentMode = CreatePaymentRequest['mode']

/** `"signature_stored"` — status returned after a successful sign call. */
export type SignatureStatus = PayerSignatureResponse['status']
