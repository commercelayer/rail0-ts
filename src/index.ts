export { Rail0Client } from './client.js'
export type { Rail0ClientOptions } from './client.js'

// ── Signing ──────────────────────────────────────────────────────────
export {
  signTransferWithAuthorization,
  signReceiveWithAuthorization,
  signAuthorize,
  signCharge,
  signPayment,
  signRefund,
  signTransaction,
} from './signing.js'
export type {
  TokenDomain,
  Eip3009Signature,
  SignTransferParams,
  SignPaymentParams,
} from './signing.js'

// ── Stablecoin registry ──────────────────────────────────────────────
export { stablecoins, chainInfo, eip3009Tokens, eip2612Tokens } from './stablecoins.js'
export type { StablecoinInfo, StablecoinChain, StablecoinSymbol } from './stablecoins.js'

// ── Errors & logging ─────────────────────────────────────────────────
export { Rail0ApiError } from './core/error.js'
export { debugLogger } from './core/http.js'
export type { Logger, LogEntry } from './core/http.js'

// ── Resources ────────────────────────────────────────────────────────
export { PaymentsResource } from './resources/payments.js'
export type { ListPaymentsParams, ListTransactionsParams } from './resources/payments.js'
export { WalletsResource } from './resources/wallets.js'
export type {
  ListWalletsParams,
  WalletBalancesParams,
  PaymentMethodsParams,
} from './resources/wallets.js'
export { WebhooksResource } from './resources/webhooks.js'
export type { ListWebhooksParams, ListEventCallbacksParams } from './resources/webhooks.js'
export { ChainsResource } from './resources/chains.js'
export { TokensResource } from './resources/tokens.js'
export { HealthResource } from './resources/health.js'
export { AuthResource, personalSign, checksumAddress } from './resources/auth.js'
export type { AuthResponse } from './resources/auth.js'

// ── Types ────────────────────────────────────────────────────────────
export type {
  // Primitives
  Address,
  Bytes32,
  Uint256String,
  // Enums
  PaymentMode,
  PaymentStatus,
  TransactionOperation,
  TransactionStatus,
  DisputeStatus,
  CircuitState,
  EventCallbackStatus,
  HealthStatus,
  WebhookTopic,
  // Signing
  EIP712Domain,
  EIP3009Message,
  PaymentConfig,
  SigningPayload,
  // Request bodies
  CreatePaymentRequest,
  PayerSignatureRequest,
  SubmitTransactionRequest,
  PrepareRequest,
  CreateWalletRequest,
  UpdateWalletRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  // Domain models
  Payment,
  PaymentDetail,
  Transaction,
  TransactionGas,
  Dispute,
  Wallet,
  WalletTokenHolding,
  WalletWithTokens,
  Token,
  Blockchain,
  AssetBalance,
  BalanceError,
  ChainBalance,
  WalletBalances,
  Nonce,
  Session,
  Webhook,
  WebhookWithSecret,
  EventCallback,
  Health,
  PaymentMethod,
  // Pagination & error
  PageMeta,
  PaginatedResponse,
  ApiErrorBody,
  // Generated internals (advanced use)
  components,
  operations,
} from './resources/types.js'
