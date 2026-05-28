import type { HttpClient } from '../core/http.js'
import type {
  ApproveRequest,
  Bytes32,
  CapturePaymentRequest,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PayerSignatureRequest,
  PayerSignatureResponse,
  PaymentResponse,
  PrepareTransactionResponse,
  RefundPaymentRequest,
  ReleaseRequest,
  SubmitTransactionAcceptedResponse,
  SubmitTransactionRequest,
} from './types.js'

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

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
  authorize(paymentId: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/authorize`)
  }

  /**
   * Prepare the unsigned charge() transaction (one-shot, no escrow).
   * The payer signature must have been submitted first via `sign()`.
   */
  charge(paymentId: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/charge`)
  }

  /** Build the unsigned capture() transaction. Called by the payee. */
  prepareCapture(paymentId: Bytes32, params: CapturePaymentRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/capture`, params)
  }

  /** Build the unsigned void() transaction. Called by the payee. */
  prepareVoid(paymentId: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/void`)
  }

  /**
   * Build the unsigned release() transaction.
   * Pass `{ callerAddress }` to build the tx for the buyer (payer).
   * Omit or pass `{}` to default to the payee.
   * release() can only succeed after authorizationExpiry has passed on-chain.
   */
  prepareRelease(paymentId: Bytes32, params?: ReleaseRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/release`, params)
  }

  /** Build the unsigned ERC-20 approve() transaction needed before a refund. Called by the payee. */
  prepareApprove(paymentId: Bytes32, params: ApproveRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/approve`, params)
  }

  /** Build the unsigned refund() transaction. Called by the payee. */
  prepareRefund(paymentId: Bytes32, params: RefundPaymentRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/refund`, params)
  }

  /**
   * Enqueue a signed transaction for asynchronous broadcast (HTTP 202).
   *
   * Universal submit endpoint — works for any preceding prepare step (authorize,
   * charge, prepareCapture, prepareVoid, prepareRelease, prepareApprove, prepareRefund).
   * The API infers the operation from `pending_operation` set by the prepare call.
   *
   * Returns immediately with `status: "submitting"`.
   * Poll `get()` until status leaves "submitting" to learn the final on-chain outcome.
   */
  submit(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(`/payments/${paymentId}/transactions/submit`, params)
  }
}
