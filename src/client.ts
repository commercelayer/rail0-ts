import { HttpClient, type HttpClientOptions } from './core/http.js'
import { AuthResource } from './resources/auth.js'
import { ChainsResource } from './resources/chains.js'
import { DisputesResource } from './resources/disputes.js'
import { HealthResource } from './resources/health.js'
import { PaymentMethodsResource } from './resources/payment_methods.js'
import { PaymentsResource } from './resources/payments.js'
import { TokensResource } from './resources/tokens.js'
import { WalletsResource } from './resources/wallets.js'
import { WebhooksResource } from './resources/webhooks.js'

export type Rail0ClientOptions = HttpClientOptions

export class Rail0Client {
  readonly auth: AuthResource
  readonly chains: ChainsResource
  readonly tokens: TokensResource
  readonly payments: PaymentsResource
  readonly disputes: DisputesResource
  readonly wallets: WalletsResource
  readonly paymentMethods: PaymentMethodsResource
  readonly webhooks: WebhooksResource
  readonly health: HealthResource

  constructor(options: Rail0ClientOptions) {
    const http = new HttpClient(options)
    this.auth = new AuthResource(http)
    this.chains = new ChainsResource(http)
    this.tokens = new TokensResource(http)
    this.payments = new PaymentsResource(http)
    this.disputes = new DisputesResource(http)
    this.wallets = new WalletsResource(http)
    this.paymentMethods = new PaymentMethodsResource(http)
    this.webhooks = new WebhooksResource(http)
    this.health = new HealthResource(http)
  }
}
