// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
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
  topic?: string
  active?: boolean
  circuit_state?: 'closed' | 'open'
  sort?: string
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
    return this.http.get(`/webhooks/${id}`)
  }

  update(id: string, params: UpdateWebhookRequest): Promise<Webhook> {
    return this.http.patch(`/webhooks/${id}`, params)
  }

  enable(id: string): Promise<Webhook> {
    return this.http.put(`/webhooks/${id}/enable`)
  }

  disable(id: string): Promise<Webhook> {
    return this.http.put(`/webhooks/${id}/disable`)
  }

  /** Rotate the shared secret — returned once in the response. */
  rotateSecret(id: string): Promise<WebhookWithSecret> {
    return this.http.put(`/webhooks/${id}/rotate_secret`)
  }

  /** Reset the delivery circuit breaker and re-enable the webhook. */
  resetCircuit(id: string): Promise<Webhook> {
    return this.http.put(`/webhooks/${id}/reset_circuit`)
  }

  /** List delivery attempts for a webhook. */
  eventCallbacks(
    id: string,
    params?: ListEventCallbacksParams,
  ): Promise<PaginatedResponse<EventCallback>> {
    return this.http.getPaginated(`/webhooks/${id}/event_callbacks${buildQuery(params)}`)
  }

  delete(id: string): Promise<void> {
    return this.http.delete(`/webhooks/${id}`)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}
