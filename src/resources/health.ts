// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type { Health } from './types.js'

export type { Health } from './types.js'

export class HealthResource {
  constructor(private readonly http: HttpClient) {}

  /** Report gateway liveness/readiness (DB, chain/contract counts). */
  get(): Promise<Health> {
    return this.http.get('/health')
  }
}
