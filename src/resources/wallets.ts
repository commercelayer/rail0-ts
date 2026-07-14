// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type {
  CreateWalletRequest,
  PaginatedResponse,
  UpdateWalletRequest,
  Wallet,
  WalletBalances,
  WalletWithTokens,
} from './types.js'

export interface ListWalletsParams {
  chain_id?: number
  token_symbol?: string
  active?: boolean
  /** Restrict nested token holdings to the default one. */
  default?: boolean
  sort?: string
  page?: number
  per_page?: number
}

export interface WalletBalancesParams {
  chain_id?: number
  token_symbol?: string
}

/**
 * Wallets and their token holdings, scoped to an account. Mirrors rail0-go's
 * WalletsService. Every method is behind SIWE — a merchant manages its OWN
 * wallets here. Public, buyer-facing discovery of a merchant's accepted
 * wallets/tokens lives on PaymentMethodsResource (GET /payment_methods).
 */
export class WalletsResource {
  constructor(private readonly http: HttpClient) {}

  /** List an account's wallets, each with its token holdings nested. */
  list(
    account_id: string,
    params?: ListWalletsParams,
  ): Promise<PaginatedResponse<WalletWithTokens>> {
    return this.http.getPaginated(`/accounts/${account_id}/wallets${buildQuery(params)}`)
  }

  /** Fetch a single wallet by UUID or 0x address. */
  get(account_id: string, id_or_address: string): Promise<Wallet> {
    return this.http.get(`/accounts/${account_id}/wallets/${id_or_address}`)
  }

  /** Add a wallet to the account. */
  create(account_id: string, params: CreateWalletRequest): Promise<Wallet> {
    return this.http.post(`/accounts/${account_id}/wallets`, params)
  }

  /** Update a wallet's label or active flag. */
  update(account_id: string, id: string, params: UpdateWalletRequest): Promise<Wallet> {
    return this.http.patch(`/accounts/${account_id}/wallets/${id}`, params)
  }

  /** Soft-delete (deactivate) a wallet. */
  delete(account_id: string, id: string): Promise<void> {
    return this.http.delete(`/accounts/${account_id}/wallets/${id}`)
  }

  /** Read a wallet's live on-chain balances (native + tokens). */
  balances(account_id: string, id: string, params?: WalletBalancesParams): Promise<WalletBalances> {
    return this.http.get(`/accounts/${account_id}/wallets/${id}/balances${buildQuery(params)}`)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}
