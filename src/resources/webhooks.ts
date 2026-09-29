// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import { path } from '../core/path.js'
import type {
  CreateWebhookRequest,
  EventCallback,
  PaginatedResponse,
  UpdateWebhookRequest,
  Webhook,
  WebhookTopic,
  WebhookWithSecret,
} from './types.js'

export interface ListWebhooksParams {
  /** Narrow to the subscriptions that INCLUDE this event. */
  topic?: WebhookTopic
  active?: boolean
  circuit_state?: 'closed' | 'open'
  sort?: string
  /** 1-based page number, bounded 1..1,000,000 — the gateway answers 400 outside that range. */
  page?: number
  per_page?: number
}

export interface ListEventCallbacksParams {
  status?: 'delivered' | 'failed'
  /**
   * Which EVENT's deliveries — singular, and unrelated to the subscription's set: one
   * subscription covering four topics has four kinds of delivery in this log, and
   * "why did the captures stop arriving" is a question about one of them.
   */
  topic?: WebhookTopic
  payment_id?: string
  /** The subscriber's exact HTTP response code, e.g. '500' — "the 500s, not the 429s". */
  response_code?: string
  /** ISO-8601. Deliveries at or after this instant. */
  since?: string
  /** ISO-8601. Deliveries at or before this instant. */
  until?: string
  sort?: string
  /** 1-based page number, bounded 1..1,000,000 — the gateway answers 400 outside that range. */
  page?: number
  per_page?: number
}

/** Webhook subscriptions for the authenticated account. All methods require a JWT. */
export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  list(params?: ListWebhooksParams): Promise<PaginatedResponse<Webhook>> {
    return this.http.getPaginated(`/webhooks${buildQuery(params)}`)
  }

  /** Register a webhook. The response includes the shared_secret — shown only here and on rotateSecret. */
  create(params: CreateWebhookRequest): Promise<WebhookWithSecret> {
    return this.http.post('/webhooks', params)
  }

  get(id: string): Promise<Webhook> {
    return this.http.get(path`/webhooks/${id}`)
  }

  update(id: string, params: UpdateWebhookRequest): Promise<Webhook> {
    return this.http.patch(path`/webhooks/${id}`, params)
  }

  enable(id: string): Promise<Webhook> {
    return this.http.put(path`/webhooks/${id}/enable`)
  }

  disable(id: string): Promise<Webhook> {
    return this.http.put(path`/webhooks/${id}/disable`)
  }

  /** Rotate the shared secret — returned once in the response. */
  rotateSecret(id: string): Promise<WebhookWithSecret> {
    return this.http.put(path`/webhooks/${id}/rotate_secret`)
  }

  /** Reset the delivery circuit breaker and re-enable the webhook. */
  resetCircuit(id: string): Promise<Webhook> {
    return this.http.put(path`/webhooks/${id}/reset_circuit`)
  }

  /** List delivery attempts for a webhook. */
  eventCallbacks(
    id: string,
    params?: ListEventCallbacksParams,
  ): Promise<PaginatedResponse<EventCallback>> {
    return this.http.getPaginated(path`/webhooks/${id}/event_callbacks` + buildQuery(params))
  }

  /**
   * POST /webhooks/:id/event_callbacks/:callback_id/redeliver — replay one recorded
   * delivery (202, `{ status: 'queued' }`).
   *
   * The recovery lever for events lost while the circuit breaker was open: the gateway
   * re-sends THAT delivery's stored payload verbatim — same embedded event `id`, so a
   * receiver that already processed it deduplicates — under a fresh timestamped
   * signature. `callbackId` is an `EventCallback.id` from eventCallbacks().
   *
   * Preconditions, because the replay is ASYNC and goes through the ordinary delivery job:
   * - The webhook must be active with a closed circuit. A disabled or circuit-open
   *   webhook drops the replay silently, like any delivery — the 202 only means queued.
   *   Call resetCircuit() first: it closes the circuit AND clears a manual disable,
   *   whereas enable() only clears the disable and leaves an open circuit open.
   * - The callback must belong to this webhook and carry a stored payload: an unknown or
   *   foreign callback id, or a row recorded before payloads were stored, answers 404.
   *   Delivery rows are purged after the gateway's retention window, so very old
   *   deliveries cannot be replayed either.
   */
  redeliver(id: string, callbackId: string): Promise<{ status: 'queued' }> {
    return this.http.post(path`/webhooks/${id}/event_callbacks/${callbackId}/redeliver`, {})
  }

  delete(id: string): Promise<void> {
    return this.http.delete(path`/webhooks/${id}`)
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
