import { HttpClient, type HttpClientOptions } from './core/http.js'
import { AccountsResource } from './resources/accounts.js'
import { AuthResource } from './resources/auth.js'
import { ChainsResource } from './resources/chains.js'
import { TokensResource } from './resources/tokens.js'
import { PaymentsResource } from './resources/payments.js'
import { WalletsResource } from './resources/wallets.js'

export type Rail0ClientOptions = HttpClientOptions

export class Rail0Client {
  readonly accounts: AccountsResource
  readonly auth: AuthResource
  readonly chains: ChainsResource
  readonly tokens: TokensResource
  readonly payments: PaymentsResource
  readonly wallets: WalletsResource

  constructor(options: Rail0ClientOptions) {
    const http = new HttpClient(options)
    this.accounts = new AccountsResource(http)
    this.auth     = new AuthResource(http)
    this.chains   = new ChainsResource(http)
    this.tokens   = new TokensResource(http)
    this.payments = new PaymentsResource(http)
    this.wallets  = new WalletsResource(http)
  }
}
