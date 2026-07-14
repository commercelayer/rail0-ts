// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type { Token } from './types.js'

export type { Token } from './types.js'

export class TokensResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List active tokens, optionally filtered by chain and/or symbol.
   * @param chain_id Chain ID to filter by. Omit or 0 for all chains.
   * @param symbol   Token symbol to filter by (case-insensitive, e.g. "USDC").
   */
  list(chain_id?: number, symbol?: string): Promise<Token[]> {
    return this.http.get(`/tokens${buildQuery({ chain_id: chain_id || undefined, symbol })}`)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}
