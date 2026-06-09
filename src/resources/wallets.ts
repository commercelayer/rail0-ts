import type { HttpClient } from '../core/http.js'
import type { PaginatedResponse, Token } from './types.js'

export interface ListWalletTokensParams {
  symbol?: string
  active?: boolean
  page?: number
  per_page?: number
}

export class WalletsResource {
  constructor(private readonly http: HttpClient) {}

  /** List tokens associated with a wallet, optionally filtered by symbol. */
  tokens(wallet_id: string, params?: ListWalletTokensParams): Promise<PaginatedResponse<Token>> {
    return this.http.get(`/wallets/${wallet_id}/tokens${buildQuery(params)}`)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
}
