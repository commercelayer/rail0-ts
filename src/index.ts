export { Rail0Client } from './client.js'

export {
  signTransferWithAuthorization,
  signAuthorize,
  signCharge,
  signPayment,
} from './signing.js'
export type {
  TokenDomain,
  Eip3009Signature,
  SignTransferParams,
  SignPaymentParams,
} from './signing.js'

export { stablecoins, chainInfo, eip3009Tokens, eip2612Tokens } from './stablecoins.js'
export type { StablecoinInfo, StablecoinChain, StablecoinSymbol } from './stablecoins.js'
export type { Rail0ClientOptions } from './client.js'

export { Rail0ApiError } from './core/error.js'

export { debugLogger } from './core/http.js'
export type { Logger, LogEntry } from './core/http.js'

export { MerchantsResource } from './resources/merchants.js'

export type {
  // Primitives
  Address,
  Bytes32,
  Uint256String,
  // Core models
  PaymentConfig,
  EIP712Domain,
  EIP3009Message,
  SigningPayload,
  // Request bodies
  CreatePaymentRequest,
  PayerSignatureRequest,
  CapturePaymentRequest,
  SubmitTransactionRequest,
  ApproveRequest,
  RefundPaymentRequest,
  ReleaseRequest,
  // Response shapes
  CreatePaymentResponse,
  PayerSignatureResponse,
  AuthorizePaymentResponse,
  ChargePaymentResponse,
  PrepareTransactionResponse,
  CapturePaymentResponse,
  VoidPaymentResponse,
  ReleasePaymentResponse,
  ApproveResponse,
  RefundPaymentResponse,
  SubmitTransactionAcceptedResponse,
  OnChainState,
  PaymentResponse,
  PaymentMethod,
  // Utility types
  PaymentMode,
  SignatureStatus,
  ApiErrorBody,
  // Generated internals (advanced use)
  components,
  operations,
} from './resources/types.js'
