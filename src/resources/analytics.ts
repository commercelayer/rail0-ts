// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type {
  Address,
  AnalyticsBucket,
  AnalyticsRow,
  AnalyticsSummary,
  PaymentMode,
  PaymentStatus,
} from './types.js'

/**
 * Shared query filters for every analytics endpoint. All optional; each narrows
 * the account's own payments (as payee). `token` + `chain_id` together scope
 * monetary volume to a single token, so sums never mix tokens/decimals.
 */
export interface AnalyticsFilters {
  mode?: PaymentMode
  status?: PaymentStatus
  /** Token address (0x…) — scopes volume to one token. */
  token?: Address
  chain_id?: number
  /** Only payments created at/after this ISO-8601 timestamp. */
  from?: string
  /** Only payments created at/before this ISO-8601 timestamp. */
  to?: string
  /**
   * Payee wallet address (0x…) — scopes analytics to that one wallet instead of
   * all the account's wallets. Must be one of the session account's wallets:
   * the gateway answers 403 otherwise, 400 if malformed.
   */
  payee?: Address
}

/** Time-bucket granularity for the timeseries endpoint (gateway default: "day"). */
export type AnalyticsInterval = 'day' | 'week' | 'month'
/** Dimension to aggregate by for the breakdown endpoint. */
export type AnalyticsDimension = 'token' | 'chain' | 'mode' | 'status' | 'operation'

/**
 * Merchant sales analytics (GET /analytics/*). Account-scoped and account-ONLY:
 * every endpoint needs a JWT with a non-null account — 401 without a token, 403
 * for an account-less (buyer) session. Results cover only the account's own
 * payments as payee, so a merchant only ever sees its own sales. Mirrors the
 * gateway's Analytics service rollups.
 */
export class AnalyticsResource {
  constructor(private readonly http: HttpClient) {}

  /** Headline KPIs: order counts, by-status counts, refund/dispute/failed rates, per-(token, chain) volume, and per-chain gas (also sliced by status and by operation). */
  summary(filters?: AnalyticsFilters): Promise<AnalyticsSummary> {
    return this.http.get(`/analytics/summary${buildQuery(filters)}`)
  }

  /** Order count per time bucket (oldest first); single-token volume only when both token and chain are filtered. */
  timeseries(
    filters?: AnalyticsFilters,
    options?: { interval?: AnalyticsInterval },
  ): Promise<AnalyticsBucket[]> {
    return this.http.get(
      `/analytics/timeseries${buildQuery({ ...filters, interval: options?.interval })}`,
    )
  }

  /** Aggregate orders by a dimension. token/chain rows carry per-token volume; mode/status are counts only. */
  breakdown(
    filters: AnalyticsFilters | undefined,
    options: { by: AnalyticsDimension },
  ): Promise<AnalyticsRow[]> {
    return this.http.get(`/analytics/breakdown${buildQuery({ ...filters, by: options.by })}`)
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
