import { HttpClient, type HttpClientOptions } from './core/http.js'
import { AccountsResource } from './resources/accounts.js'
import { ChainsResource } from './resources/chains.js'
import { TokensResource } from './resources/tokens.js'
import { PaymentsResource } from './resources/payments.js'

export type Rail0ClientOptions = HttpClientOptions

export class Rail0Client {
  readonly accounts: AccountsResource
  readonly chains: ChainsResource
  readonly tokens: TokensResource
  readonly payments: PaymentsResource

  constructor(options: Rail0ClientOptions) {
    const http = new HttpClient(options)
    this.accounts = new AccountsResource(http)
    this.chains   = new ChainsResource(http)
    this.tokens   = new TokensResource(http)
    this.payments = new PaymentsResource(http)
  }
}
