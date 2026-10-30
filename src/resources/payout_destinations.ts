// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import { path } from '../core/path.js'
import type {
  CreatePayoutDestinationRequest,
  PaginatedResponse,
  PayoutDestination,
  PayoutDestinationStatus,
  PayoutEvent,
  UpdatePayoutDestinationRequest,
} from './types.js'

/**
 * The statement `confirm_details: true` records (POST /payout_destinations, and a PATCH that
 * changes `min_amount`): show `text` to the merchant and send the flag only once they
 * have made the check. A new wording gets a new `version` on the gateway.
 */
export const PAYOUT_DETAILS_CONFIRMATION = {
  version: 'details_v1',
  text: "I have checked the address, network, token and minimum deposit on the venue's deposit page and confirm they are correct. Funds sent to a wrong address or network, or below the venue's minimum, may be permanently lost and cannot be recovered by rail0.",
} as const

export interface ListPayoutDestinationsParams {
  /** Restrict to one wallet (uuid). */
  wallet_id?: string
  status?: PayoutDestinationStatus
  sort?: string
  /** 1-based page number, bounded 1..1,000,000 — the gateway answers 400 outside that range. */
  page?: number
  per_page?: number
}

/** Offset paging for an audit trail (newest first; `per_page` defaults to 25, at most 100). */
export interface ListPayoutEventsParams {
  /** 1-based page number, bounded 1..1,000,000 — the gateway answers 400 outside that range. */
  page?: number
  per_page?: number
}

/**
 * Payout destinations (JWT): the deposit addresses — at an exchange, Circle Mint, another
 * wallet — the account's wallets cash out to. Each is bound to ONE chain and ONE token,
 * by design: an exchange credits only the network it issued the address for.
 *
 * Lifecycle: `create` (born `unverified`) → a `proof` payout (`payouts.prepare({
 * destination_id, purpose: 'proof' })`) → once the venue credited it, `confirm` (now
 * `verified`, fires `payout_destinations.verified`). Until then the destination may
 * receive the proof amount at most (`payout_destination_unverified`).
 *
 * Reads are account-wide; writes act for the destination's own wallet (403
 * `not_your_wallet` otherwise), except that any wallet of the account may disable one.
 * A deactivated account is read-only (403 `account_deactivated`).
 */
export class PayoutDestinationsResource {
  constructor(private readonly http: HttpClient) {}

  /** List the account's destinations. */
  list(params?: ListPayoutDestinationsParams): Promise<PaginatedResponse<PayoutDestination>> {
    return this.http.getPaginated(`/payout_destinations${buildQuery(params)}`)
  }

  /**
   * Register a destination for the session's own wallet (201, `unverified`).
   *
   * `confirm_details: true` is required — the merchant's statement of
   * `PAYOUT_DETAILS_CONFIRMATION.text`; never set it on their behalf. `min_amount` is
   * required as well (`"0"` when the venue has none; 422 `minimum_required`). Refused: the zero
   * address, the wallet itself, and every contract the gateway knows on the chain (422
   * `payout_destination_*`); the same address/token/chain twice on a wallet (409
   * `payout_destination_exists`).
   */
  create(params: CreatePayoutDestinationRequest): Promise<PayoutDestination> {
    return this.http.post('/payout_destinations', params)
  }

  get(id: string): Promise<PayoutDestination> {
    return this.http.get(path`/payout_destinations/${id}`)
  }

  /**
   * Update the label, reserve, minimum or `active` flag. Changing `min_amount` needs
   * `confirm_details: true` (422 `confirmation_required` otherwise, nothing written) and
   * may not be blank — `"0"` removes the minimum (422 `minimum_required`); raising it above the latest proof's amount takes the verification away. `active:
   * false` cancels an unsigned pending payout to it, and is refused 409
   * `payout_already_signed` while a signed one is pending.
   */
  update(id: string, params: UpdatePayoutDestinationRequest): Promise<PayoutDestination> {
    return this.http.patch(path`/payout_destinations/${id}`, params)
  }

  /**
   * Attest that the venue credited the proof transfer: the destination becomes
   * `verified`. The proof must be `confirmed` on-chain first (422
   * `payout_destination_proof_missing`) — check the credit at the venue, not here.
   */
  confirm(id: string): Promise<PayoutDestination> {
    return this.http.post(path`/payout_destinations/${id}/confirm`, {})
  }

  /** The destination's audit trail — its own events and its payouts', newest first. */
  events(id: string, params?: ListPayoutEventsParams): Promise<PaginatedResponse<PayoutEvent>> {
    return this.http.getPaginated(path`/payout_destinations/${id}/events` + buildQuery(params))
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
