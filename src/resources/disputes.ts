// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type { ListDisputesParams } from './payments.js'
import type { Dispute, PaginatedResponse } from './types.js'

/**
 * Account-level dispute list (requires JWT). Complements
 * PaymentsResource.disputes (one payment's open/close history): this surfaces
 * every dispute — open AND closed — across the caller's payments (as payer or
 * payee), each with its parent `payment` embedded. A closed dispute drops out
 * of the `disputed` filter on PaymentsResource.list (current-state) but still
 * appears here.
 */
export class DisputesResource {
  constructor(private readonly http: HttpClient) {}

  /** List the account's disputes (open and closed). */
  list(params?: ListDisputesParams): Promise<PaginatedResponse<Dispute>> {
    return this.http.getPaginated(`/disputes${buildQuery(params)}`)
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
