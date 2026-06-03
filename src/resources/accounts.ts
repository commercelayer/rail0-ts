// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type { PaginatedResponse, PaymentMethod, WalletToken } from './types.js'

export interface ListWalletsParams {
  chain_id?: number
  chain_slug?: string
  token_symbol?: string
  active?: boolean
  page?: number
  per_page?: number
}

export class AccountsResource {
  constructor(private readonly http: HttpClient) {}

  /** Return the active payment methods (chain + token + wallet) for the given account. */
  paymentMethods(account_id: string): Promise<PaymentMethod[]> {
    return this.http.get(`/accounts/${account_id}/payment-methods`)
  }

  /**
   * Return paginated wallet tokens for the given account. Public — no JWT required.
   * @example
   * const { data, meta } = await client.accounts.wallets(accountId, { token_symbol: 'USDC', active: true })
   */
  wallets(account_id: string, params?: ListWalletsParams): Promise<PaginatedResponse<WalletToken>> {
    return this.http.get(`/accounts/${account_id}/wallets${buildQuery(params)}`)
  }

  /** Return a single wallet token by id. Public — no JWT required. */
  wallet(account_id: string, id: string): Promise<WalletToken> {
    return this.http.get(`/accounts/${account_id}/wallets/${id}`)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
}
