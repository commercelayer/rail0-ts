import type { HttpClient } from '../core/http.js'
import type { PaginatedResponse, Wallet } from './types.js'

export interface ListWalletsParams {
  active?: boolean
  page?: number
  per_page?: number
}

export interface CreateWalletParams {
  address: string
  label?: string
}

export interface UpdateWalletParams {
  label?: string
  active?: boolean
}

export class AccountsResource {
  constructor(private readonly http: HttpClient) {}

  /** List wallets for an account. */
  wallets(account_id: string, params?: ListWalletsParams): Promise<PaginatedResponse<Wallet>> {
    return this.http.get(`/accounts/${account_id}/wallets${buildQuery(params)}`)
  }

  /** Return a single wallet by id. */
  wallet(account_id: string, id: string): Promise<Wallet> {
    return this.http.get(`/accounts/${account_id}/wallets/${id}`)
  }

  /** Add a wallet to the account. */
  createWallet(account_id: string, params: CreateWalletParams): Promise<Wallet> {
    return this.http.post(`/accounts/${account_id}/wallets`, params)
  }

  /** Update a wallet label or active status. */
  updateWallet(account_id: string, id: string, params: UpdateWalletParams): Promise<Wallet> {
    return this.http.patch(`/accounts/${account_id}/wallets/${id}`, params)
  }

  /** Soft-delete (deactivate) a wallet. */
  deleteWallet(account_id: string, id: string): Promise<void> {
    return this.http.delete(`/accounts/${account_id}/wallets/${id}`)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
}
