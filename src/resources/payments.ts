import type { HttpClient } from '../core/http.js'
import type {
  Bytes32,
  CapturePaymentRequest,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PayerSignatureRequest,
  PayerSignatureResponse,
  PaymentResponse,
  PrepareTransactionResponse,
  ReleaseRequest,
  SubmitTransactionRequest,
} from './types.js'

export interface RefundPayloadParams {
  amount: string
  v?: number
  r?: string
  s?: string
}

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /** List payments for the authenticated account. Requires authentication. */
  list(): Promise<PaymentResponse[]> {
    return this.http.get('/payments')
  }

  /** Fetch current payment state (DB status + live on-chain escrow balances). */
  get(paymentId: Bytes32): Promise<PaymentResponse> {
    return this.http.get(`/payments/${paymentId}`)
  }

  /** Create a payment intent. Returns the EIP-712 signingPayload for the payer to sign. */
  createPayment(params: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.http.post('/payments', params)
  }

  /** Submit the payer's EIP-712 signature (v, r, s). */
  sign(paymentId: Bytes32, params: PayerSignatureRequest): Promise<PayerSignatureResponse> {
    return this.http.put(`/payments/${paymentId}/sign`, params)
  }

  /** Prepare the unsigned authorize() transaction. Called by the payee. */
  authorizePayload(paymentId: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/authorize/payload`)
  }

  /**
   * Submit the signed authorize transaction (HTTP 202, async).
   * Sign the `unsignedTransaction` from `authorizePayload()` with the payee's key
   * and pass it here. Poll `get()` until status leaves "submitting".
   */
  authorize(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<{ rail0_id: string; status: string }> {
    return this.http.post(`/payments/${paymentId}/authorize`, params)
  }

  /**
   * Prepare the unsigned charge() transaction (one-shot, no escrow).
   * The payer signature must have been submitted first via `sign()`.
   */
  chargePayload(paymentId: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/charge/payload`)
  }

  /**
   * Submit the signed charge transaction (HTTP 202, async).
   * Poll `get()` until status leaves "submitting".
   */
  charge(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<{ rail0_id: string; status: string }> {
    return this.http.post(`/payments/${paymentId}/charge`, params)
  }

  /** Build the unsigned capture() transaction. Called by the payee. */
  capturePayload(paymentId: Bytes32, params: CapturePaymentRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/capture/payload`, params)
  }

  /** Submit the signed capture transaction (HTTP 202, async). */
  capture(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<{ rail0_id: string; status: string }> {
    return this.http.post(`/payments/${paymentId}/capture`, params)
  }

  /** Build the unsigned void() transaction. Called by the payee. */
  voidPayload(paymentId: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/void/payload`)
  }

  /** Submit the signed void transaction (HTTP 202, async). */
  void(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<{ rail0_id: string; status: string }> {
    return this.http.post(`/payments/${paymentId}/void`, params)
  }

  /**
   * Build the unsigned release() transaction.
   * Pass `{ callerAddress }` to build the tx for the buyer (payer).
   * Omit or pass `{}` to default to the payee.
   * release() can only succeed after authorizationExpiry has passed on-chain.
   */
  releasePayload(paymentId: Bytes32, params?: ReleaseRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/release/payload`, params)
  }

  /** Submit the signed release transaction (HTTP 202, async). */
  release(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<{ rail0_id: string; status: string }> {
    return this.http.post(`/payments/${paymentId}/release`, params)
  }

  /**
   * Refund payload — two-phase EIP-3009 flow.
   *
   * Phase 1 — call with `{ amount }` only:
   *   Returns an EIP-3009 `receiveWithAuthorization` signing payload.
   *   The payee signs it off-chain (v, r, s).
   *
   * Phase 2 — call with `{ amount, v, r, s }`:
   *   Returns the unsigned on-chain refund transaction ready to sign and submit.
   */
  refundPayload(paymentId: Bytes32, params: RefundPayloadParams): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/refund/payload`, params)
  }

  /** Submit the signed refund transaction (HTTP 202, async). */
  refund(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<{ rail0_id: string; status: string }> {
    return this.http.post(`/payments/${paymentId}/refund`, params)
  }
}
