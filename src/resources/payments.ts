// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type {
  Bytes32,
  CreatePaymentRequest,
  Dispute,
  PaginatedResponse,
  PayerSignatureRequest,
  Payment,
  PaymentDetail,
  PrepareRequest,
  SubmitTransactionRequest,
  Transaction,
  TransactionOperation,
} from './types.js'

export interface ListPaymentsParams {
  status?: string
  mode?: string
  payer?: string
  payee?: string
  token?: string
  rail0_id?: string
  sort?: string
  page?: number
  per_page?: number
}

export interface ListTransactionsParams {
  operation?: string
  status?: string
  sort?: string
  page?: number
  per_page?: number
}

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /** Create a payment. Returns the PaymentDetail, including the EIP-712 signing_payload for the payer. */
  create(params: CreatePaymentRequest): Promise<PaymentDetail> {
    return this.http.post('/payments', params)
  }

  /** List payments for the authenticated wallet (payer or payee). Requires a JWT. */
  list(params?: ListPaymentsParams): Promise<PaginatedResponse<Payment>> {
    return this.http.getPaginated(`/payments${buildQuery(params)}`)
  }

  /** Fetch a payment's current state (DB status + live on-chain balances + transactions). */
  get(id: Bytes32): Promise<PaymentDetail> {
    return this.http.get(`/payments/${id}`)
  }

  /** List a payment's on-chain transactions. */
  transactions(
    id: Bytes32,
    params?: ListTransactionsParams,
  ): Promise<PaginatedResponse<Transaction>> {
    return this.http.getPaginated(`/payments/${id}/transactions${buildQuery(params)}`)
  }

  /** Store the payer's EIP-3009 signature (moves the payment to `signed`). */
  sign(id: Bytes32, params: PayerSignatureRequest): Promise<PaymentDetail> {
    return this.http.put(`/payments/${id}/sign`, params)
  }

  /** List the payment's dispute open/close history. */
  disputes(id: Bytes32): Promise<Dispute[]> {
    return this.http.get(`/payments/${id}/disputes`)
  }

  // ── Generic prepare/submit ─────────────────────────────────────────
  /** Build the unsigned transaction for an operation. */
  prepare(
    id: Bytes32,
    operation: TransactionOperation | 'dispute' | 'close_dispute',
    body?: PrepareRequest,
  ): Promise<Transaction> {
    return this.http.post(`/payments/${id}/${operation}/prepare`, body)
  }

  /** Broadcast a signed transaction for an operation (HTTP 202, async). */
  submit(
    id: Bytes32,
    operation: TransactionOperation | 'dispute' | 'close_dispute',
    params: SubmitTransactionRequest,
  ): Promise<Transaction> {
    return this.http.post(`/payments/${id}/${operation}`, params)
  }

  // ── Operation-specific pairs (payee unless noted) ──────────────────
  authorizePrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(`/payments/${id}/authorize/prepare`)
  }
  authorize(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(`/payments/${id}/authorize`, params)
  }

  chargePrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(`/payments/${id}/charge/prepare`)
  }
  charge(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(`/payments/${id}/charge`, params)
  }

  capturePrepare(id: Bytes32, amount: string): Promise<Transaction> {
    return this.http.post(`/payments/${id}/capture/prepare`, { amount })
  }
  capture(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(`/payments/${id}/capture`, params)
  }

  voidPrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(`/payments/${id}/void/prepare`)
  }
  void(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(`/payments/${id}/void`, params)
  }

  /** Release an expired escrow (permissionless). `from` defaults to the payer. */
  releasePrepare(id: Bytes32, from?: string): Promise<Transaction> {
    return this.http.post(`/payments/${id}/release/prepare`, from ? { from } : undefined)
  }
  release(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(`/payments/${id}/release`, params)
  }

  /**
   * Refund prepare — two-phase EIP-3009 flow.
   * Phase 1: `{ amount }` → Transaction carrying a signing_payload for the payee to sign.
   * Phase 2: `{ amount, signature }` → the unsigned on-chain refund transaction.
   */
  refundPrepare(id: Bytes32, body: PrepareRequest): Promise<Transaction> {
    return this.http.post(`/payments/${id}/refund/prepare`, body)
  }
  refund(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(`/payments/${id}/refund`, params)
  }

  /** Open a dispute (payer, signal-only). Optional bytes32 reason code. */
  disputePrepare(id: Bytes32, reason?: string): Promise<Transaction> {
    return this.http.post(`/payments/${id}/dispute/prepare`, reason ? { reason } : undefined)
  }
  dispute(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(`/payments/${id}/dispute`, params)
  }

  /** Close a dispute (payer). Optional bytes32 reason code. */
  closeDisputePrepare(id: Bytes32, reason?: string): Promise<Transaction> {
    return this.http.post(`/payments/${id}/dispute/close/prepare`, reason ? { reason } : undefined)
  }
  closeDispute(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(`/payments/${id}/dispute/close`, params)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}
