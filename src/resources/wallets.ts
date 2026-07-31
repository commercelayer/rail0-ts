// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type {
  AddWalletTokenRequest,
  CreateWalletRequest,
  PaginatedResponse,
  UpdateWalletRequest,
  Wallet,
  WalletBalances,
  WalletTokenHolding,
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

  /**
   * Add a wallet to the account. Requires a SIWE proof-of-ownership of the
   * address being added: pass the EIP-4361 `message` (nonce from
   * `POST /auth/nonces`) and its `signature`, produced with the added wallet's
   * own key — see CreateWalletRequest. The gateway rejects a signature that does
   * not recover to `address` (422) and an address already registered anywhere (409).
   */
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

  // ── Accepted tokens ────────────────────────────────────────────────
  // The (wallet, token) holdings that power the public GET /payment_methods and
  // gate payment creation: POST /payments refuses a payee/token pair the wallet
  // does not accept (422 unsupported_payment_method), so onboarding a merchant is
  // wallets.create + at least one addToken — a wallet with no holding is invisible
  // to buyers and unusable as a payee.
  //
  // `token_id` on remove/enable/disable is the TOKEN's UUID (as returned in
  // WalletTokenHolding.token), NOT an id of the holding row — the gateway looks
  // the holding up by (wallet, token). A non-UUID is a clean 404.

  /**
   * Accept a token (chain) on this wallet — an upsert on (wallet, token): a
   * previously-disabled holding is reactivated rather than duplicated. The
   * gateway answers 201 when it creates the holding and 200 when it reactivates
   * or updates one; both return the holding, so the SDK does not distinguish them.
   */
  addToken(
    account_id: string,
    id: string,
    params: AddWalletTokenRequest,
  ): Promise<WalletTokenHolding> {
    return this.http.post(`/accounts/${account_id}/wallets/${id}/tokens`, params)
  }

  /**
   * Stop accepting a token — soft delete (204). The holding row survives with
   * active:false (and loses `default`), so its history is kept and enableToken
   * can bring it back.
   */
  removeToken(account_id: string, id: string, token_id: string): Promise<void> {
    return this.http.delete(`/accounts/${account_id}/wallets/${id}/tokens/${token_id}`)
  }

  /** Re-enable an EXISTING holding. 404 when the wallet has none for the token — use addToken to create one. */
  enableToken(account_id: string, id: string, token_id: string): Promise<WalletTokenHolding> {
    return this.http.patch(`/accounts/${account_id}/wallets/${id}/tokens/${token_id}/enable`)
  }

  /** Disable an EXISTING holding (same effect as removeToken, but returns the holding). 404 when absent. */
  disableToken(account_id: string, id: string, token_id: string): Promise<WalletTokenHolding> {
    return this.http.patch(`/accounts/${account_id}/wallets/${id}/tokens/${token_id}/disable`)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}
