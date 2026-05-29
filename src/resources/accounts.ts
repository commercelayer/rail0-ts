import type { HttpClient } from '../core/http.js'
import type { PaymentMethod } from './types.js'

export class AccountsResource {
  constructor(private readonly http: HttpClient) {}

  /** Return the active payment methods (chain + token + wallet) for the given merchant. */
  paymentMethods(accountId: number): Promise<PaymentMethod[]> {
    return this.http.get(`/accounts/${accountId}/payment-methods`)
  }
}
