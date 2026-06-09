import type { HttpClient } from '../core/http.js'
import type { CatalogToken } from './types.js'

export type { CatalogToken } from './types.js'

export class TokensResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List active catalog tokens, optionally filtered by chain.
   * @param chain_id Chain ID to filter by. Omit for all chains.
   */
  list(chain_id?: number): Promise<CatalogToken[]> {
    const path = chain_id && chain_id !== 0 ? `/tokens?chain_id=${chain_id}` : '/tokens'
    return this.http.get(path)
  }
}
