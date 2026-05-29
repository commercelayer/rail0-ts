import type { HttpClient } from '../core/http.js'

export interface Blockchain {
  chain_id: number
  name: string
  slug: string
  network_type: string
  explorer_url: string
}

export class ChainsResource {
  constructor(private readonly http: HttpClient) {}

  /** List all active blockchains supported by RAIL0. */
  list(): Promise<Blockchain[]> {
    return this.http.get('/blockchains')
  }
}
