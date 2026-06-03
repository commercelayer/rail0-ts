// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type { Blockchain } from './types.js'

export type { Blockchain } from './types.js'

export class ChainsResource {
  constructor(private readonly http: HttpClient) {}

  /** List all active blockchains supported by RAIL0. */
  list(): Promise<Blockchain[]> {
    return this.http.get('/blockchains')
  }
}
