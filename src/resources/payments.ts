// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import { path } from '../core/path.js'
import type {
  Bytes32,
  CreatePaymentRequest,
  Dispute,
  DisputeStatus,
  PaginatedResponse,
  PayerSignatureRequest,
  Payment,
  PaymentDetail,
  PaymentMode,
  PaymentStatus,
  PrepareRequest,
  StoredTransactionOperation,
  SubmitByHashRequest,
  SubmitTransactionRequest,
  Transaction,
  TransactionOperation,
  TransactionStatus,
} from './types.js'

// The gateway validates these filters with Grape `values:` and answers 400 on
// anything else, so they are typed as the unions rather than bare strings —
// `list({ status: 'cancelled' })` is a compile error, not a runtime 400.
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
   * gateway accepts all eight stored operations here, so `?operation=dispute` —
   * the very filter rail0-cli#47 was fixed to allow — must type-check. It was
   * `string` while the spec's record enum was missing those two values
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

/** Opt-in idempotency for the prepare endpoints. */
export interface IdempotentRequest {
  /** Client-chosen key; replaying it returns the transaction the first call created. */
  idempotencyKey?: string
}

function idempotencyHeader(opts?: IdempotentRequest): Record<string, string> | undefined {
  return opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined
}

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a payment. Returns the PaymentDetail, including the EIP-712 signing_payload for the payer.
   *
   * Pass `idempotencyKey` to make the request replay-safe: a repeated call with
   * the same key returns the existing payment (HTTP 200) instead of creating a new one.
   */
  create(params: CreatePaymentRequest, idempotencyKey?: string): Promise<PaymentDetail> {
    return this.http.post(
      '/payments',
      params,
      idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    )
  }

  /** List payments for the authenticated wallet (payer or payee). Requires a JWT. */
  list(params?: ListPaymentsParams): Promise<PaginatedResponse<Payment>> {
    return this.http.getPaginated(`/payments${buildQuery(params)}`)
  }

  /** Fetch a payment's current state (DB status + live on-chain balances + transactions). */
  get(id: Bytes32): Promise<PaymentDetail> {
    return this.http.get(path`/payments/${id}`)
  }

  /** List a payment's on-chain transactions. */
  transactions(
    id: Bytes32,
    params?: ListTransactionsParams,
  ): Promise<PaginatedResponse<Transaction>> {
    return this.http.getPaginated(path`/payments/${id}/transactions` + buildQuery(params))
  }

  /**
   * Fetch ONE of a payment's transactions by id — the read the list could only answer by
   * returning every row (commercelayer/rail0-gateway#330).
   *
   * This is the lookup for an `action_id`: anything that was handed a transaction id when
   * an operation was accepted resolves it directly, instead of fetching the payment and
   * scanning its transactions for an id it already holds. Participant-readable; an unknown,
   * malformed or foreign transaction id all answer 404 alike.
   */
  getTransaction(id: Bytes32, transactionId: string): Promise<Transaction> {
    return this.http.get(path`/payments/${id}/transactions/${transactionId}`)
  }

  /**
   * POST /payments/:id/transactions/:transaction_id/redrive — re-enqueue a stuck broadcast.
   *
   * For the one shape a retry can fix: a transaction that is `pending` and whose SIGNED
   * bytes the gateway holds — prepared and signed, never landed on the chain (a worker
   * that died between the two, a Sidekiq queue drained by hand). Nothing about the
   * payment changes; the same signed bytes are handed to the broadcaster again.
   *
   * `Transaction.redrivable` is the same predicate the gateway guards this with, so a
   * caller can offer the action exactly when it will succeed rather than discovering a
   * 422. A `pending` row with no signed transaction is NOT redrivable — there the next
   * step is submitting the signature, not retrying a send that never happened.
   */
  redrive(id: Bytes32, transactionId: string): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/transactions/${transactionId}/redrive`, {})
  }

  /** Store the payer's EIP-3009 signature (moves the payment to `signed`). */
  sign(id: Bytes32, params: PayerSignatureRequest): Promise<PaymentDetail> {
    return this.http.put(path`/payments/${id}/sign`, params)
  }

  /** List the payment's dispute open/close history (paginated). */
  disputes(id: Bytes32, params?: ListDisputesParams): Promise<PaginatedResponse<Dispute>> {
    return this.http.getPaginated(path`/payments/${id}/disputes` + buildQuery(params))
  }

  // ── Generic prepare/submit ─────────────────────────────────────────
  // For the standard operations only (authorize/capture/charge/void/release/
  // refund). Dispute and close-dispute have their own paths (dispute/prepare and
  // dispute/close/prepare) — use disputePrepare/dispute and closeDisputePrepare/
  // closeDispute, not this generic form.
  /** Build the unsigned transaction for an operation. */
  /**
   * `opts.idempotencyKey` makes a repeat safe. Without it, a retry that arrives after the
   * first transaction was signed and broadcast opens a SECOND one — correct for a genuine
   * sequential partial capture, wrong for a retry, and only the caller can tell those
   * apart (commercelayer/rail0-gateway#331). Same key with different terms is refused 422
   * `idempotency_key_reused`; the key is scoped to this payment.
   */
  prepare(
    id: Bytes32,
    operation: TransactionOperation,
    body?: PrepareRequest,
    opts?: IdempotentRequest,
  ): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/${operation}/prepare`, body, idempotencyHeader(opts))
  }

  /** Broadcast a signed transaction for an operation (HTTP 202, async). */
  submit(
    id: Bytes32,
    operation: TransactionOperation,
    params: SubmitTransactionRequest,
  ): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/${operation}`, params)
  }

  /** Record an already-broadcast transaction by hash (MetaMask signs+broadcasts in one step).
   *  Payee-only for the merchant operations; `release` is authorized for either participant
   *  (payer or payee). The payer operations dispute/close-dispute have their own payer-only
   *  report-by-hash methods below (disputeSubmitByHash / closeDisputeSubmitByHash). */
  submitByHash(
    id: Bytes32,
    operation: TransactionOperation,
    params: SubmitByHashRequest,
  ): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/${operation}/submitted`, params)
  }

  // ── Operation-specific pairs (payee unless noted) ──────────────────
  authorizePrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/authorize/prepare`)
  }
  authorize(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/authorize`, params)
  }

  chargePrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/charge/prepare`)
  }
  charge(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/charge`, params)
  }

  /** `amount` is a human decimal (e.g. "10.50") — the gateway converts to token base units. */
  capturePrepare(id: Bytes32, amount: string): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/capture/prepare`, { amount })
  }
  capture(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/capture`, params)
  }

  voidPrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/void/prepare`)
  }
  void(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/void`, params)
  }

  /** Release an expired escrow (permissionless). `from` defaults to the payer. */
  releasePrepare(id: Bytes32, from?: string): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/release/prepare`, from ? { from } : undefined)
  }
  release(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/release`, params)
  }

  /**
   * Refund prepare — two-phase EIP-3009 flow.
   * Phase 1: `{ amount }` → Transaction carrying a signing_payload for the payee to sign.
   * Phase 2: `{ amount, signature }` → the unsigned on-chain refund transaction.
   */
  refundPrepare(id: Bytes32, body: PrepareRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/refund/prepare`, body)
  }
  refund(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/refund`, params)
  }

  /** Open a dispute (payer, signal-only). Optional bytes32 reason code. */
  disputePrepare(id: Bytes32, reason?: string, opts?: IdempotentRequest): Promise<Transaction> {
    return this.http.post(
      path`/payments/${id}/dispute/prepare`,
      reason ? { reason } : undefined,
      idempotencyHeader(opts),
    )
  }
  dispute(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/dispute`, params)
  }

  /** Close a dispute (payer). Optional bytes32 reason code. */
  closeDisputePrepare(
    id: Bytes32,
    reason?: string,
    opts?: IdempotentRequest,
  ): Promise<Transaction> {
    return this.http.post(
      path`/payments/${id}/dispute/close/prepare`,
      reason ? { reason } : undefined,
      idempotencyHeader(opts),
    )
  }
  closeDispute(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/dispute/close`, params)
  }

  /** Report an already-broadcast dispute tx by hash (MetaMask buyer flow). Payer-only:
   *  the payer authenticates account-less via SIWE, since the bare hash carries no
   *  signature. The payer's counterpart to submitByHash. */
  disputeSubmitByHash(id: Bytes32, params: SubmitByHashRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/dispute/submitted`, params)
  }

  /** Report an already-broadcast close-dispute tx by hash (MetaMask buyer flow). Payer-only. */
  closeDisputeSubmitByHash(id: Bytes32, params: SubmitByHashRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/dispute/close/submitted`, params)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}
