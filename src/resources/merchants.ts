import type { HttpClient } from '../core/http.js'
import type { PaymentMethod } from './types.js'

export class MerchantsResource {
  constructor(private readonly http: HttpClient) {}

  /** Return the active payment methods (chain + token + wallet) for the given merchant. */
  paymentMethods(merchantId: number): Promise<PaymentMethod[]> {
    return this.http.get(`/merchants/${merchantId}/payment-methods`)
  }
}
