// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import { path } from '../core/path.js'
import type {
  Bytes32,
  CreatePaymentRequest,
  Dispute,
  DisputeCloseReason,
  DisputeOpenReason,
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
  UpdatePaymentRequest,
} from './types.js'

// The gateway validates these filters with Grape `values:` and answers 400 on
// anything else, so they are typed as the unions rather than bare strings —
// `list({ status: 'cancelled' })` is a compile error, not a runtime 400.
export interface ListPaymentsParams {
  /**
   * One status, or several: an array matches ANY of them and is sent comma-separated
   * (`status=authorized,expired`), so one call replaces a fetch-per-status-and-merge.
   */
  status?: PaymentStatus | PaymentStatus[]
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
  /**
   * Only payments carrying at least one transaction with this operation. The RECORD
   * vocabulary, as on `transactions()`: a payment whose only transaction is a dispute
   * must be findable by it, so `dispute`/`close_dispute` are accepted too.
   */
  operation?: StoredTransactionOperation
  sort?: string
  /** 1-based page number, bounded 1..1,000,000 — the gateway answers 400 outside that range. */
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
  /**
   * One status, or several (matches any; sent comma-separated) — e.g.
   * `['submitting', 'submitted']` for "on its way to the chain" in one call.
   */
  status?: TransactionStatus | TransactionStatus[]
  sort?: string
  /** 1-based page number, bounded 1..1,000,000 — the gateway answers 400 outside that range. */
  page?: number
  per_page?: number
}

export interface ListDisputesParams {
  /** Filter by dispute status ("open" or "closed"). */
  status?: DisputeStatus
  sort?: string
  /** 1-based page number, bounded 1..1,000,000 — the gateway answers 400 outside that range. */
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

  /**
   * PATCH /payments/:id — set or clear the payment's description. Returns the same
   * PaymentDetail as `get`.
   *
   * `id` is the payment UUID or its `rail0_id`. Participant-only (payer or payee):
   * 401 without a session, 404 for a non-participant (indistinguishable from an unknown
   * id), 403 `wallet_deactivated` from a retired wallet. Allowed in every status,
   * closed ones included: the description is gateway-side only — in nothing signed or
   * hashed on chain — so this moves no money and dispatches no webhook. `null` or `""`
   * clears it; over 255 characters is a 422.
   */
  update(id: string, body: UpdatePaymentRequest): Promise<PaymentDetail> {
    return this.http.patch(path`/payments/${id}`, body)
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
  // Every typed prepare takes the same optional `opts` as the generic `prepare`, and
  // forwards it the same way (Idempotency-Key header) — see the note on `prepare` for
  // why a retry without a key can open a second transaction.
  authorizePrepare(id: Bytes32, opts?: IdempotentRequest): Promise<Transaction> {
    return this.http.post(
      path`/payments/${id}/authorize/prepare`,
      undefined,
      idempotencyHeader(opts),
    )
  }
  authorize(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/authorize`, params)
  }

  chargePrepare(id: Bytes32, opts?: IdempotentRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/charge/prepare`, undefined, idempotencyHeader(opts))
  }
  charge(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/charge`, params)
  }

  /** `amount` is a human decimal (e.g. "10.50") — the gateway converts to token base units. */
  capturePrepare(id: Bytes32, amount: string, opts?: IdempotentRequest): Promise<Transaction> {
    return this.http.post(
      path`/payments/${id}/capture/prepare`,
      { amount },
      idempotencyHeader(opts),
    )
  }
  capture(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/capture`, params)
  }

  voidPrepare(id: Bytes32, opts?: IdempotentRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/void/prepare`, undefined, idempotencyHeader(opts))
  }
  void(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/void`, params)
  }

  /**
   * Release an expired escrow. `from` is the submitter the transaction is built for
   * (its nonce): the payment's payer or payee — the gateway answers 422
   * `release_submitter_not_a_party` otherwise. Omitted, it is the signed-in caller.
   */
  releasePrepare(id: Bytes32, from?: string, opts?: IdempotentRequest): Promise<Transaction> {
    return this.http.post(
      path`/payments/${id}/release/prepare`,
      from ? { from } : undefined,
      idempotencyHeader(opts),
    )
  }
  release(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/release`, params)
  }

  /**
   * Refund prepare — two-phase EIP-3009 flow.
   * Phase 1: `{ amount }` → Transaction carrying a signing_payload for the payee to sign.
   * Phase 2: `{ amount, signature }` → the unsigned on-chain refund transaction.
   */
  refundPrepare(id: Bytes32, body: PrepareRequest, opts?: IdempotentRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/refund/prepare`, body, idempotencyHeader(opts))
  }
  refund(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/refund`, params)
  }

  /**
   * Open a dispute (payer, signal-only). `reason` is optional: a DisputeOpenReason code
   * (e.g. `'not_received'`, see DISPUTE_OPEN_REASONS) or exactly that code's bytes32.
   * Omitted (or the all-zero bytes32) means no reason — the calldata carries bytes32 zero
   * and the dispute reads "No reason given". Any other value is refused 422
   * `unknown_dispute_reason`.
   */
  disputePrepare(
    id: Bytes32,
    reason?: DisputeOpenReason | Bytes32,
    opts?: IdempotentRequest,
  ): Promise<Transaction> {
    return this.http.post(
      path`/payments/${id}/dispute/prepare`,
      reason ? { reason } : undefined,
      idempotencyHeader(opts),
    )
  }
  dispute(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(path`/payments/${id}/dispute`, params)
  }

  /**
   * Close a dispute (payer). `reason` is optional: a DisputeCloseReason code (e.g.
   * `'withdrawn'`, see DISPUTE_CLOSE_REASONS) or exactly that code's bytes32. Omitted
   * (or the all-zero bytes32) means no reason. The system `full_refund` is recorded by
   * the protocol and refused here (422 `unknown_dispute_reason`), as is any other value
   * outside the dictionary.
   */
  closeDisputePrepare(
    id: Bytes32,
    reason?: DisputeCloseReason | Bytes32,
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

/**
 * Serialises a params object into a query string. An array value is sent as ONE
 * comma-separated parameter (`status=authorized,expired`) — the OpenAPI `style: form,
 * explode: false` the gateway documents for its multi-value filters — with each element
 * encoded on its own so the separating commas stay literal. An empty array is dropped,
 * as `status=` would be a 400. Scalars are unchanged.
 */
function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0),
  )
  if (entries.length === 0) return ''
  const encode = (v: unknown): string =>
    Array.isArray(v)
      ? v.map((x) => encodeURIComponent(String(x))).join(',')
      : encodeURIComponent(String(v))
  return `?${entries.map(([k, v]) => `${k}=${encode(v)}`).join('&')}`
}
