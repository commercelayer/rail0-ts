// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type {
  Bytes32,
  CapturePaymentRequest,
  CreatePaymentRequest,
  CreatePaymentResponse,
  GetPaymentResponse,
  PaginatedResponse,
  PayerSignatureRequest,
  PayerSignatureResponse,
  PaymentSummary,
  PrepareRefundResponse,
  PrepareTransactionResponse,
  SubmitTransactionAcceptedResponse,
  SubmitTransactionRequest,
  TransactionRecord,
} from './types.js'

export interface ListPaymentsParams {
  status?: string
  mode?: string
  payer?: string
  payee?: string
  token?: string
  page?: number
  per_page?: number
}

export interface ListTransactionsParams {
  operation?: string
  status?: string
  page?: number
  per_page?: number
}

export interface RefundPrepareParams {
  amount: string
  v?: number
  r?: string
  s?: string
}

/** @deprecated Use RefundPrepareParams */
export type RefundPayloadParams = RefundPrepareParams

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List payments for the authenticated wallet. Requires a JWT.
   * Returns a paginated response — access items via `.data` and pagination info via `.meta`.
   */
  list(params?: ListPaymentsParams): Promise<PaginatedResponse<PaymentSummary>> {
    return this.http.get(`/payments${buildQuery(params)}`)
  }

  /** Create a payment intent. Returns the EIP-712 signingPayload for the payer to sign. */
  create(params: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.http.post('/payments', params)
  }

  /** Fetch current payment state (DB status + live on-chain escrow balances). */
  get(rail0_id: Bytes32): Promise<GetPaymentResponse> {
    return this.http.get(`/payments/${rail0_id}`)
  }

  /**
   * List on-chain transactions for a payment.
   * Returns a paginated response — access items via `.data` and pagination info via `.meta`.
   */
  transactions(rail0_id: Bytes32, params?: ListTransactionsParams): Promise<PaginatedResponse<TransactionRecord>> {
    return this.http.get(`/payments/${rail0_id}/transactions${buildQuery(params)}`)
  }

  /** Submit the payer's EIP-712 signature (v, r, s). */
  sign(rail0_id: Bytes32, params: PayerSignatureRequest): Promise<PayerSignatureResponse> {
    return this.http.put(`/payments/${rail0_id}/sign`, params)
  }

  /** Prepare the unsigned authorize() transaction. Called by the payee. */
  authorizePrepare(rail0_id: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${rail0_id}/authorize/prepare`)
  }

  /**
   * Submit the signed authorize transaction (HTTP 202, async).
   * Poll `get()` until status leaves "submitting".
   */
  authorize(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(`/payments/${rail0_id}/authorize`, params)
  }

  /** Prepare the unsigned charge() transaction (one-shot, no escrow). */
  chargePrepare(rail0_id: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${rail0_id}/charge/prepare`)
  }

  /**
   * Submit the signed charge transaction (HTTP 202, async).
   * Poll `get()` until status leaves "submitting".
   */
  charge(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(`/payments/${rail0_id}/charge`, params)
  }

  /** Build the unsigned capture() transaction. Called by the payee. */
  capturePrepare(rail0_id: Bytes32, params: CapturePaymentRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${rail0_id}/capture/prepare`, params)
  }

  /** Submit the signed capture transaction (HTTP 202, async). */
  capture(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(`/payments/${rail0_id}/capture`, params)
  }

  /** Build the unsigned void() transaction. Called by the payee. */
  voidPrepare(rail0_id: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${rail0_id}/void/prepare`)
  }

  /** Submit the signed void transaction (HTTP 202, async). */
  void(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(`/payments/${rail0_id}/void`, params)
  }

  /** Build the unsigned release() transaction. */
  releasePrepare(rail0_id: Bytes32, params?: Record<string, unknown>): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${rail0_id}/release/prepare`, params)
  }

  /** Submit the signed release transaction (HTTP 202, async). */
  release(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(`/payments/${rail0_id}/release`, params)
  }

  /**
   * Refund prepare — two-phase EIP-3009 flow.
   * Phase 1: call with `{ amount }` only — returns a signing payload.
   * Phase 2: call with `{ amount, v, r, s }` — returns the unsigned on-chain refund transaction.
   */
  refundPrepare(rail0_id: Bytes32, params: RefundPrepareParams): Promise<PrepareRefundResponse> {
    return this.http.post(`/payments/${rail0_id}/refund/prepare`, params)
  }

  /** Submit the signed refund transaction (HTTP 202, async). */
  refund(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(`/payments/${rail0_id}/refund`, params)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
}
