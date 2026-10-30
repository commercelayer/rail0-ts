// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import { path } from '../core/path.js'
import { signPayoutTransaction } from '../signing.js'
import type { PayoutTxExpectation } from '../tx-verify.js'
import type { ListPayoutEventsParams } from './payout_destinations.js'
import type {
  PaginatedResponse,
  Payout,
  PayoutEvent,
  PayoutPurpose,
  PayoutStatus,
  PreparePayoutRequest,
  SubmitByHashRequest,
  SubmitTransactionRequest,
} from './types.js'

export interface ListPayoutsParams {
  destination_id?: string
  wallet_id?: string
  /** One status, or several: an array matches ANY of them and is sent comma-separated. */
  status?: PayoutStatus | PayoutStatus[]
  purpose?: PayoutPurpose
  /** Only payouts created at/after this ISO-8601 timestamp (inclusive). */
  created_from?: string
  /** Only payouts created at/before this ISO-8601 timestamp (inclusive). */
  created_to?: string
  /**
   * Cursor paging: the previous page's `meta.next_cursor`. Walks the collection by
   * `-created_at` at a constant cost per page, with no total count; the last page has no
   * `next_cursor`. Not combinable with `page` or another `sort` (422 `invalid_cursor`).
   * Omit it for page-number paging.
   */
  after?: string
  /** e.g. `-amount` (numeric). Newest first by default. */
  sort?: string
  /** 1-based page number, bounded 1..1,000,000 — the gateway answers 400 outside that range. */
  page?: number
  per_page?: number
}

/**
 * What the caller knows about a payout beyond the record itself, held against it before
 * signing — see `PayoutTxExpectation`. `prepareAndSubmit` fills `amount` from its own
 * request.
 */
export type PayoutCheck = Omit<PayoutTxExpectation, 'payout'>

/**
 * Payouts (JWT): the on-chain leg of a merchant cash-out — an ERC-20 `transfer` from one
 * of the account's wallets to a payout destination. The gateway builds the transfer; the
 * merchant's wallet signs it. It never holds funds, keys or fiat.
 *
 * Two ways to send a prepared payout:
 * - sign offline and `submit` the raw bytes (the gateway stores them, then broadcasts;
 *   `resend` re-broadcasts the same bytes) — `signAndSubmit` / `prepareAndSubmit` do this
 *   with a private key, verifying the transfer first;
 * - broadcast from the wallet yourself and report the hash with `submitByHash`.
 *
 * One pending payout per destination: a re-prepare replaces it while unsigned; once
 * signed it is resent, never re-prepared (409 `payout_already_signed`). Settlement fires
 * `payouts.confirmed` / `payouts.failed`.
 */
export class PayoutsResource {
  constructor(private readonly http: HttpClient) {}

  /** The account's payout history, newest first. */
  list(params?: ListPayoutsParams): Promise<PaginatedResponse<Payout>> {
    return this.http.getPaginated(`/payouts${buildQuery(params)}`)
  }

  get(id: string): Promise<Payout> {
    return this.http.get(path`/payouts/${id}`)
  }

  /** The payout's audit trail, newest first. */
  events(id: string, params?: ListPayoutEventsParams): Promise<PaginatedResponse<PayoutEvent>> {
    return this.http.getPaginated(path`/payouts/${id}/events` + buildQuery(params))
  }

  /**
   * Build the unsigned transfer (201 new, 200 re-prepared). Returns the Payout with
   * `unsigned_transaction` beside its decoded intent (`chain_id`, `token`, `address`,
   * `amount`) — verify before signing (`signPayoutTransaction` always does).
   *
   * Refused: `payout_destination_unverified` (more than the proof before `confirm`),
   * `payout_below_minimum`, `insufficient_balance` (names what is available after the
   * reserve), `payout_limit_reached`, `payout_destination_disabled`,
   * `payout_destination_minimum_unset` (no minimum stated — set it with
   * `payoutDestinations.update` first), 409 `payout_already_signed`.
   */
  prepare(params: PreparePayoutRequest): Promise<Payout> {
    return this.http.post('/payouts/prepare', params)
  }

  /**
   * Submit the signed transfer; the gateway stores it with its hash, then broadcasts
   * (202, `submitted`). A node refusal is a 502 and leaves the row `pending` with
   * `signed: true` — `resend` it.
   */
  submit(id: string, params: SubmitTransactionRequest): Promise<Payout> {
    return this.http.post(path`/payouts/${id}/submit`, params)
  }

  /** Re-broadcast the stored signed transfer — same bytes, same nonce, same hash (202). */
  resend(id: string): Promise<Payout> {
    return this.http.post(path`/payouts/${id}/resend`, {})
  }

  /**
   * Cancel an UNSIGNED pending payout (now `failed` / `cancelled`, fires
   * `payouts.failed`). A signed one is 409 `payout_already_signed`: its transaction may
   * still be mined — resend it, or replace its nonce from the wallet.
   */
  cancel(id: string): Promise<Payout> {
    return this.http.post(path`/payouts/${id}/cancel`, {})
  }

  /**
   * Record a transfer the wallet broadcast itself (202, `submitted`). A hash a node
   * already has must be THIS transfer (`foreign_transfer_hash` otherwise). Also revives a
   * payout failed `submission_timeout` or `dropped` with a late or replacement hash.
   */
  submitByHash(id: string, params: SubmitByHashRequest): Promise<Payout> {
    return this.http.post(path`/payouts/${id}/submitted`, params)
  }

  /**
   * Verify, sign and submit a prepared payout with a private key — the transfer is held
   * to the payout's decoded intent and to `check` (`signPayoutTransaction`) BEFORE the key
   * touches it; a mismatch rejects with `refusing to sign: …` and nothing is sent.
   */
  async signAndSubmit(
    payout: Payout,
    privateKey: `0x${string}` | Uint8Array,
    check?: PayoutCheck,
  ): Promise<Payout> {
    const signed = signPayoutTransaction(payout.unsigned_transaction, privateKey, {
      ...check,
      payout,
    })
    return this.submit(payout.id, { signed_transaction: signed })
  }

  /**
   * Prepare, verify, sign and submit in one call. The prepared payout is held to
   * `params.destination_id` and, for a decimal `amount`, to that amount exactly — which
   * needs `check.decimals` (the token's scale, from your own records: a scale the gateway
   * reported could inflate the amount). For `"all"` or a proof the gateway decides the
   * amount: pass `check.maxAmount` to cap it. Pass `check.destination` to hold the payout
   * to the destination's chain, token and address too.
   */
  async prepareAndSubmit(
    params: PreparePayoutRequest,
    privateKey: `0x${string}` | Uint8Array,
    check?: PayoutCheck,
  ): Promise<Payout> {
    const payout = await this.prepare(params)
    if (payout.destination_id !== params.destination_id) {
      throw new Error(
        `refusing to sign: the gateway prepared a payout to destination ${payout.destination_id}, not ${params.destination_id}`,
      )
    }
    const wantPurpose = params.purpose ?? 'payout'
    if (payout.purpose !== wantPurpose) {
      throw new Error(
        `refusing to sign: the gateway prepared a ${payout.purpose}, not a ${wantPurpose}`,
      )
    }
    const amount = 'amount' in params ? params.amount : undefined
    return this.signAndSubmit(payout, privateKey, {
      ...check,
      ...(amount !== undefined ? { amount } : {}),
    })
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
