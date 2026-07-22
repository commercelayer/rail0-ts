import { HttpClient, type HttpClientOptions } from './core/http.js'
import { AnalyticsResource } from './resources/analytics.js'
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
  private readonly http: HttpClient
  readonly auth: AuthResource
  readonly chains: ChainsResource
  readonly tokens: TokensResource
  readonly payments: PaymentsResource
  readonly disputes: DisputesResource
  readonly wallets: WalletsResource
  readonly paymentMethods: PaymentMethodsResource
  readonly webhooks: WebhooksResource
  readonly analytics: AnalyticsResource
  readonly health: HealthResource

  constructor(options: Rail0ClientOptions) {
    this.http = new HttpClient(options)
    this.auth = new AuthResource(this.http)
    this.chains = new ChainsResource(this.http)
    this.tokens = new TokensResource(this.http)
    this.payments = new PaymentsResource(this.http)
    this.disputes = new DisputesResource(this.http)
    this.wallets = new WalletsResource(this.http)
    this.paymentMethods = new PaymentMethodsResource(this.http)
    this.webhooks = new WebhooksResource(this.http)
    this.analytics = new AnalyticsResource(this.http)
    this.health = new HealthResource(this.http)
  }

  /**
   * Set (or clear) the Bearer token used for every subsequent request across all
   * resources. Call after `auth.login()` to authenticate a long-lived client
   * without reconstructing it; pass null/undefined to sign out.
   */
  setAuthToken(token: string | null | undefined): void {
    this.http.setAuthToken(token)
  }
}
