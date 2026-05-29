import type { HttpClient } from '../core/http.js'

export interface Token {
  chain_id: number
  chain_slug: string
  symbol: string
  address: string
  decimals: number
}

export class TokensResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List active tokens, optionally filtered by chain.
   * @param chainId Chain ID to filter by. Omit for all chains.
   */
  list(chainId?: number): Promise<Token[]> {
    const path = chainId && chainId !== 0 ? `/tokens?chain_id=${chainId}` : '/tokens'
    return this.http.get(path)
  }
}
