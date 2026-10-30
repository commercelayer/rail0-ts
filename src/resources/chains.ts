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
 * Pick ONE chain from a `chains.list()` result by slug or by numeric chain id — so a
 * caller can say `arc` instead of `5042002`.
 *
 * - A number, or a string of digits, matches `chain_id`.
 * - Anything else matches `slug`, case-insensitively (after trimming). A slug is shared
 *   by a chain's testnet and mainnet and unique only per `network_type`; a gateway serves
 *   one network class, so its own list has one match — but a list that mixes both classes
 *   can have two, and that is an error rather than a guess.
 *
 * Throws when nothing matches (the message names the available slugs) or when a slug is
 * ambiguous (the message names the matching chain ids and network types).
 */
export function resolveChain(blockchains: readonly Blockchain[], ref: string | number): Blockchain {
  const raw = typeof ref === 'number' ? String(ref) : ref.trim()
  if (raw === '') throw new Error('resolveChain: empty chain reference')
  const byId = /^[0-9]+$/.test(raw)
  const needle = raw.toLowerCase()
  const matches = blockchains.filter((b) =>
    byId ? b.chain_id === Number(raw) : (b.slug ?? '').toLowerCase() === needle,
  )
  if (matches.length === 1) return matches[0] as Blockchain
  if (matches.length > 1) {
    const which = matches
      .map((b) => `${b.chain_id} (${b.network_type ?? 'unknown network'})`)
      .join(', ')
    throw new Error(
      `resolveChain: "${raw}" is ambiguous — it matches chains ${which}; filter the list by network_type or pass the chain id`,
    )
  }
  const slugs = [...new Set(blockchains.map((b) => b.slug).filter((s): s is string => !!s))].sort()
  throw new Error(
    `resolveChain: no chain matches ${byId ? 'chain id' : 'slug'} "${raw}" — available slugs: ${slugs.length ? slugs.join(', ') : '(none)'}`,
  )
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
