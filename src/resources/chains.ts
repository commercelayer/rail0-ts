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

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}
