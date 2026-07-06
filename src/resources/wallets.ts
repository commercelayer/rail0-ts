// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type {
  CreateWalletRequest,
  PaginatedResponse,
  PaymentMethod,
  UpdateWalletRequest,
  Wallet,
  WalletBalances,
  WalletWithTokens,
} from './types.js'

export interface ListWalletsParams {
  chain_id?: number
  token_symbol?: string
  active?: boolean
  sort?: string
  page?: number
  per_page?: number
}

export interface WalletBalancesParams {
  chain_id?: number
  token_symbol?: string
}

export interface PaymentMethodsParams {
  chain_id?: number
  token_symbol?: string
}

/**
 * Wallets and their token holdings, scoped to an account. Mirrors rail0-go's
 * WalletsService. The list endpoint is public (no JWT); mutations require a JWT.
 */
export class WalletsResource {
  constructor(private readonly http: HttpClient) {}

  /** List an account's wallets, each with its token holdings nested. */
  list(account_id: string, params?: ListWalletsParams): Promise<PaginatedResponse<WalletWithTokens>> {
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

  /**
   * Convenience (client-side): the account's active wallets flattened to
   * (address, chain_id, token) payment methods — the same shape rail0-go returns.
   * There is no dedicated gateway endpoint; this lists active wallets and flattens.
   */
  async paymentMethods(account_id: string, params?: PaymentMethodsParams): Promise<PaymentMethod[]> {
    const { data } = await this.list(account_id, { active: true })
    const methods: PaymentMethod[] = []
    for (const w of data) {
      for (const holding of w.tokens ?? []) {
        if (holding.active === false || !holding.token) continue
        const t = holding.token
        if (params?.chain_id && t.chain_id !== params.chain_id) continue
        if (params?.token_symbol && t.symbol?.toUpperCase() !== params.token_symbol.toUpperCase()) continue
        methods.push({ address: w.address ?? '', chain_id: t.chain_id ?? 0, token: t })
      }
    }
    return methods
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
}
