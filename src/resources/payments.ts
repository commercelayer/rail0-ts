import type { HttpClient } from '../core/http.js'
import type {
  ApproveRequest,
  ApproveResponse,
  AuthorizePaymentResponse,
  Bytes32,
  CapturePaymentRequest,
  CapturePaymentResponse,
  ChargePaymentResponse,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PayerSignatureRequest,
  PayerSignatureResponse,
  PrepareTransactionResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  ReleasePaymentResponse,
  SubmitTransactionRequest,
  VoidPaymentResponse,
} from './types.js'

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /** Create a payment intent. Returns the EIP-712 signingPayload for the payer to sign. */
  createPayment(params: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.http.post('/payments', params)
  }

  /** Submit the payer's EIP-712 signature (v, r, s). */
  sign(paymentId: Bytes32, params: PayerSignatureRequest): Promise<PayerSignatureResponse> {
    return this.http.put(`/payments/${paymentId}/sign`, params)
  }

  /** Relay the stored EIP-3009 signature to the RAIL0 authorize() function. Called by the payee. */
  authorize(paymentId: Bytes32): Promise<AuthorizePaymentResponse> {
    return this.http.post(`/payments/${paymentId}/authorize`)
  }

  /** Relay the stored EIP-3009 signature to the RAIL0 charge() function (one-shot). Called by the payee. */
  charge(paymentId: Bytes32): Promise<ChargePaymentResponse> {
    return this.http.post(`/payments/${paymentId}/charge`)
  }

  /** Build the unsigned capture() transaction. Called by the payee. */
  prepareCapture(paymentId: Bytes32, params: CapturePaymentRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/capture`, params)
  }

  /** Broadcast a signed capture transaction. Called by the payee. */
  submitCapture(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<CapturePaymentResponse> {
    return this.http.post(`/payments/${paymentId}/capture/submit`, params)
  }

  /** Build the unsigned void() transaction. Called by the payee. */
  prepareVoid(paymentId: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/void`)
  }

  /** Broadcast a signed void transaction. Called by the payee. */
  submitVoid(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<VoidPaymentResponse> {
    return this.http.post(`/payments/${paymentId}/void/submit`, params)
  }

  /** Release escrowed funds back to the payer after authorizationExpiry. Permissionless. */
  release(paymentId: Bytes32): Promise<ReleasePaymentResponse> {
    return this.http.post(`/payments/${paymentId}/release`)
  }

  /** Build the unsigned ERC-20 approve() transaction needed before a refund. Called by the payee. */
  prepareApprove(paymentId: Bytes32, params: ApproveRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/approve`, params)
  }

  /** Broadcast a signed ERC-20 approve transaction. Called by the payee. */
  submitApprove(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<ApproveResponse> {
    return this.http.post(`/payments/${paymentId}/approve/submit`, params)
  }

  /** Build the unsigned refund() transaction. Called by the payee. */
  prepareRefund(paymentId: Bytes32, params: RefundPaymentRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(`/payments/${paymentId}/refund`, params)
  }

  /** Broadcast a signed refund transaction. Called by the payee. */
  submitRefund(paymentId: Bytes32, params: SubmitTransactionRequest): Promise<RefundPaymentResponse> {
    return this.http.post(`/payments/${paymentId}/refund/submit`, params)
  }
}
