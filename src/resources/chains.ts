// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type { Blockchain } from './types.js'

export type { Blockchain } from './types.js'

export interface ListChainsParams {
  /** Filter by network type ("testnet" or "mainnet"). */
  network_type?: string
  /** Filter by native symbol (case-insensitive, e.g. "ETH"). */
  symbol?: string
}

export class ChainsResource {
  constructor(private readonly http: HttpClient) {}

  /** List active blockchains supported by RAIL0, optionally filtered. */
  list(params?: ListChainsParams): Promise<Blockchain[]> {
    return this.http.get(`/blockchains${buildQuery(params)}`)
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
