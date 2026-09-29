// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type { WalletWithTokens } from './types.js'

/**
 * Selects the merchant whose payment methods to list. Provide EXACTLY ONE:
 * account_id returns all the merchant's active wallets; address returns just
 * that one wallet. Both empty (or both set) is rejected by the gateway (400).
 */
export interface PaymentMethodsQuery {
  account_id?: string
  address?: string
}

/**
 * Public, buyer-facing discovery of a merchant's accepted payment methods
 * (GET /payment_methods). Unlike WalletsResource (behind SIWE), this needs no
 * JWT: a payer that only knows the merchant — by account id, or by one of its
 * wallet addresses — lists the active wallet/token combinations it accepts.
 */
export class PaymentMethodsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the merchant's active wallets, each with its active token holdings
   * nested under `tokens` (WalletWithTokens) — the same wallet-centric shape as
   * WalletsResource.list, but public and scoped by the query. An unknown
   * account/address yields an empty array. No pagination.
   */
  list(query: PaymentMethodsQuery): Promise<WalletWithTokens[]> {
    return this.http.get(`/payment_methods${buildQuery(query)}`)
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
