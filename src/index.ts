export type { Rail0ClientOptions } from './client.js'
export { Rail0Client } from './client.js'
// ── Errors & logging ─────────────────────────────────────────────────
export { Rail0ApiError } from './core/error.js'
export type { LogEntry, Logger } from './core/http.js'
export { debugLogger } from './core/http.js'
export type { AuthResponse } from './resources/auth.js'
export { AuthResource, checksumAddress, personalSign } from './resources/auth.js'
export { ChainsResource } from './resources/chains.js'
export { HealthResource } from './resources/health.js'
export type { ListPaymentsParams, ListTransactionsParams } from './resources/payments.js'
// ── Resources ────────────────────────────────────────────────────────
export { PaymentsResource } from './resources/payments.js'
export { TokensResource } from './resources/tokens.js'
// ── Types ────────────────────────────────────────────────────────────
export type {
  // Primitives
  Address,
  ApiErrorBody,
  AssetBalance,
  BalanceError,
  Blockchain,
  Bytes32,
  ChainBalance,
  CircuitState,
  // Request bodies
  CreatePaymentRequest,
  CreateWalletRequest,
  CreateWebhookRequest,
  // Generated internals (advanced use)
  components,
  Dispute,
  DisputeStatus,
  // Signing
  EIP712Domain,
  EIP3009Message,
  EventCallback,
  EventCallbackStatus,
  Health,
  HealthStatus,
  Nonce,
  operations,
  // Pagination & error
  PageMeta,
  PaginatedResponse,
  PayerSignatureRequest,
  // Domain models
  Payment,
  PaymentConfig,
  PaymentDetail,
  PaymentMethod,
  // Enums
  PaymentMode,
  PaymentStatus,
  PrepareRequest,
  Session,
  SigningPayload,
  SubmitTransactionRequest,
  Token,
  Transaction,
  TransactionOperation,
  TransactionStatus,
  Uint256String,
  UpdateWalletRequest,
  UpdateWebhookRequest,
  Wallet,
  WalletBalances,
  WalletTokenHolding,
  WalletWithTokens,
  Webhook,
  WebhookTopic,
  WebhookWithSecret,
} from './resources/types.js'
export type {
  ListWalletsParams,
  PaymentMethodsParams,
  WalletBalancesParams,
} from './resources/wallets.js'
export { WalletsResource } from './resources/wallets.js'
export type { ListEventCallbacksParams, ListWebhooksParams } from './resources/webhooks.js'
export { WebhooksResource } from './resources/webhooks.js'
export type {
  Eip3009Signature,
  SignPaymentParams,
  SignTransferParams,
  TokenDomain,
} from './signing.js'
// ── Signing ──────────────────────────────────────────────────────────
export {
  signAuthorize,
  signCharge,
  signPayment,
  signReceiveWithAuthorization,
  signRefund,
  signTransaction,
  signTransferWithAuthorization,
} from './signing.js'
export type { StablecoinChain, StablecoinInfo, StablecoinSymbol } from './stablecoins.js'
// ── Stablecoin registry ──────────────────────────────────────────────
export { chainInfo, eip2612Tokens, eip3009Tokens, stablecoins } from './stablecoins.js'
