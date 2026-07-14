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

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}
