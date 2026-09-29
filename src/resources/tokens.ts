// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type { Token } from './types.js'

export type { Token } from './types.js'

export class TokensResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List tokens, optionally filtered by chain, symbol and/or active flag.
   *
   * Returns EVERY token by default, retired ones included — a payment references
   * its token address forever, so resolving a historical payment needs them, and
   * each carries `active`. Pass `active: true` on a path that must only offer
   * what a NEW payment can use.
   *
   * @param chain_id Chain ID to filter by. Omit or 0 for all chains.
   * @param symbol   Token symbol to filter by (case-insensitive, e.g. "USDC").
   * @param active   Filter by active flag; omit for every token.
   */
  list(chain_id?: number, symbol?: string, active?: boolean): Promise<Token[]> {
    return this.http.get(
      `/tokens${buildQuery({ chain_id: chain_id || undefined, symbol, active })}`,
    )
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
