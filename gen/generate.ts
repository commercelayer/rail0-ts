/**
 * Code generation pipeline for the RAIL0 TypeScript SDK.
 *
 * Run with: pnpm generate
 *
 * Steps:
 *   1. Read the OpenAPI schema from the rail0-gateway repo
 *   2. Generate raw TypeScript types via openapi-typescript → src/api.ts
 *   3. Emit src/resources/types.ts — public SDK types (gateway vocabulary)
 *   4. Emit src/resources/{payments,wallets,webhooks,chains,tokens,health}.ts
 *
 * The type vocabulary mirrors the gateway OpenAPI schemas (Payment, PaymentDetail,
 * Transaction, Dispute, Wallet, WalletWithTokens, WalletBalances, Webhook,
 * EventCallback, Health, …), keeping the SDK aligned with rail0-go. The signing
 * types (EIP712Domain / EIP3009Message / PaymentConfig / SigningPayload) are not
 * named in the spec, so they are hand-authored here (as in rail0-go).
 *
 * Schema source (in priority order):
 *   1. RAIL0_SCHEMA_URL env var — remote URL
 *   2. RAIL0_SCHEMA_PATH env var — absolute path to a local openapi.json
 *   3. Default: ../rail0-gateway/docs/openapi.json (sibling repo, the live API)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const genDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(genDir, '..')

const GENERATED_FILE = resolve(root, 'src/api.ts')
const RESOURCES_DIR = resolve(root, 'src/resources')

const FILE_HEADER = '// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.'

function schemaSource(): URL {
  if (process.env.RAIL0_SCHEMA_URL) return new URL(process.env.RAIL0_SCHEMA_URL)
  const localPath =
    process.env.RAIL0_SCHEMA_PATH ?? resolve(root, '..', 'rail0-gateway', 'docs', 'openapi.json')
  return new URL(`file://${localPath}`)
}

// ---------------------------------------------------------------------------
// Step 1 — openapi-typescript → src/api.ts
// ---------------------------------------------------------------------------

async function generateApiTypes(): Promise<void> {
  const url = schemaSource()
  console.log(`Reading schema: ${url}`)
  const ast = await openapiTS(url)
  await mkdir(resolve(root, 'src'), { recursive: true })
  await writeFile(GENERATED_FILE, astToString(ast), 'utf-8')
  console.log(`Generated: ${GENERATED_FILE}`)
}

// ---------------------------------------------------------------------------
// Step 2 — src/resources/types.ts (hand-authored, gateway vocabulary)
// ---------------------------------------------------------------------------

const TYPES = `${FILE_HEADER}

// Raw generated types for advanced use.
export type { components, operations } from '../api.js'

// ── Primitive aliases ────────────────────────────────────────────────
/** Checksummed or lowercase Ethereum address (42 chars, 0x-prefixed). */
export type Address = string
/** 32-byte value, hex-encoded (66 chars, 0x-prefixed). */
export type Bytes32 = string
/** Unsigned 256-bit integer serialised as a decimal string. */
export type Uint256String = string

// ── Enums ────────────────────────────────────────────────────────────
export type PaymentMode = 'authorize' | 'charge'
export type PaymentStatus =
  | 'unsigned'
  | 'signed'
  | 'authorized'
  | 'charged'
  | 'captured'
  | 'partially_captured'
  | 'voided'
  | 'released'
  | 'refunded'
  | 'partially_refunded'
export type TransactionOperation = 'authorize' | 'charge' | 'capture' | 'void' | 'release' | 'refund'
export type TransactionStatus = 'pending' | 'submitting' | 'submitted' | 'confirmed' | 'failed'
export type DisputeStatus = 'open' | 'closed'
export type CircuitState = 'closed' | 'open'
export type EventCallbackStatus = 'pending' | 'delivered' | 'failed'
export type HealthStatus = 'ok' | 'degraded'
/** Webhook event topics. Mirrors the gateway's WebhookTopic enum. */
export type WebhookTopic =
  | 'payments.created'
  | 'payments.signed'
  | 'payments.authorized'
  | 'payments.charged'
  | 'payments.captured'
  | 'payments.voided'
  | 'payments.released'
  | 'payments.refunded'
  | 'payments.failed'
  | 'payments.disputed'
  | 'payments.dispute_closed'

// ── Signing types (not named in the spec; hand-authored, as in rail0-go) ──
export interface EIP712Domain {
  name: string
  version: string
  chainId: number
  verifyingContract: Address
}
export interface EIP3009Message {
  from: Address
  to: Address
  value: Uint256String
  validAfter: Uint256String
  validBefore: Uint256String
  nonce: Bytes32
}
/** Immutable payment configuration returned inside a payment record. */
export interface PaymentConfig {
  payer: Address
  payee: Address
  token: Address
  amount: Uint256String
  authorization_expiry: number
  refund_expiry: number
}
/** EIP-712 typed-data payload to pass to eth_signTypedData_v4 (or the SDK signer). */
export interface SigningPayload {
  domain: EIP712Domain
  types: Record<string, unknown>
  primaryType: string
  message: EIP3009Message
}

// ── Request bodies ───────────────────────────────────────────────────
export interface CreatePaymentRequest {
  chain_id: number
  mode: PaymentMode
  amount: string
  token: Address
  payer: Address
  payee: Address
  description?: string
  metadata?: Record<string, unknown>
}
export interface PayerSignatureRequest {
  signature: string
}
export interface SubmitTransactionRequest {
  signed_transaction: string
}
/** Body for the submit-by-hash endpoints (MetaMask reports the broadcast tx hash). */
export interface SubmitByHashRequest {
  transaction_hash: string
}
/** Body for the generic prepare endpoints. amount → capture/refund; signature → refund phase-2; from → release. */
export interface PrepareRequest {
  amount?: string
  signature?: string
  from?: Address
}
export interface CreateWalletRequest {
  address: string
  label?: string
}
export interface UpdateWalletRequest {
  label?: string
  active?: boolean
}
export interface CreateWebhookRequest {
  name: string
  callback_url: string
  topic: WebhookTopic
}
export interface UpdateWebhookRequest {
  name?: string
  callback_url?: string
  topic?: WebhookTopic
}

// ── Domain models (gateway vocabulary) ───────────────────────────────
/** Condensed payment record (GET /payments list item). */
// Fields always present on a fetched payment are required for ergonomics
// (the gateway serialises them on every read); bookkeeping/nullable fields stay optional.
export interface Payment {
  id?: string
  contract_id?: string
  rail0_id: Bytes32
  status: PaymentStatus
  mode: PaymentMode
  amount: Uint256String
  capturable_amount?: Uint256String
  refundable_amount?: Uint256String
  config_hash?: Bytes32
  payer: Address
  payee: Address
  token: Address
  authorization_expiry: number
  refund_expiry: number
  disputed?: boolean
  last_error_code?: string | null
  last_error_message?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
  signed_at?: string | null
  created_at: string
  updated_at?: string
}
/** Single-payment view: adds chain context, embedded transactions, and (when unsigned) the signing payload. */
export interface PaymentDetail extends Payment {
  chain_id: number
  rail0_contract?: Address
  transactions?: Transaction[]
  signing_payload?: SigningPayload | null
}
export interface Transaction {
  id: string
  payment_id?: string
  operation: TransactionOperation
  status: TransactionStatus
  unsigned_transaction?: string | null
  transaction_hash?: string | null
  amount?: Uint256String | null
  block_number?: number | null
  /** Decoded on-chain failure (null unless status is "failed"): error_code is the RAIL0 custom error in snake_case (e.g. "not_payee"), or "revert" when the selector is unknown; error_message is its human-readable form (e.g. "NotPayee"). */
  error_code?: string | null
  error_message?: string | null
  /** On-chain gas/receipt data, mirrored from the indexer on confirm; null until confirmed. */
  gas_used?: Uint256String | null
  gas_limit?: Uint256String | null
  effective_gas_price?: Uint256String | null
  base_fee_per_gas?: Uint256String | null
  /** Derived (gas_used * effective_gas_price); null until confirmed. */
  gas_cost?: Uint256String | null
  /** Present for refund prepare phase-1: the EIP-3009 payload for the payee to sign. */
  signing_payload?: SigningPayload | null
  pending_at?: string | null
  submitted_at?: string | null
  confirmed_at?: string | null
  created_at?: string
  updated_at?: string
}
export interface Dispute {
  id?: string
  payment_id?: string
  status?: DisputeStatus
  reason?: string
  opened_block?: number | null
  opened_at?: string
  closed_by?: 'payer' | 'payee' | null
  close_reason?: string | null
  closed_block?: number | null
  closed_at?: string | null
}
export interface Wallet {
  id?: string
  account_id?: string
  address?: string
  label?: string | null
  active?: boolean
  created_at?: string
  updated_at?: string
}
export interface WalletTokenHolding {
  token?: Token
  active?: boolean
  default?: boolean
}
/** A wallet with its token holdings nested inline (GET /accounts/:id/wallets). */
export interface WalletWithTokens extends Wallet {
  tokens?: WalletTokenHolding[]
}
export interface Token {
  chain_id?: number
  symbol?: string
  address?: string
  decimals?: number
}
export interface Blockchain {
  chain_id?: number
  name?: string
  native_symbol?: string
  network_type?: string
  explorer_url?: string
}
export interface AssetBalance {
  symbol?: string
  address?: string | null
  decimals?: number
  raw?: string
  amount?: string
}
export interface BalanceError {
  code?: 'rpc_unavailable' | 'rpc_error' | 'timeout' | 'error'
  message?: string
}
export interface ChainBalance {
  chain_id?: number
  network_type?: string
  native?: AssetBalance
  tokens?: AssetBalance[]
  error?: BalanceError
}
export interface WalletBalances {
  wallet_id?: string
  address?: string
  balances?: ChainBalance[]
}
export interface Nonce {
  id?: string
  value?: string
  expires_at?: string
  used?: boolean
  created_at?: string
  updated_at?: string
}
export interface Session {
  token?: string
  address?: string
  account_id?: string
  expires_at?: string
}
export interface Webhook {
  id?: string
  name?: string
  callback_url?: string
  topic?: WebhookTopic
  active?: boolean
  circuit_state?: CircuitState
  circuit_failure_count?: number
  created_at?: string
  updated_at?: string
}
/** Webhook view including the shared secret. Returned only on create and rotate_secret. */
export interface WebhookWithSecret extends Webhook {
  shared_secret?: string
}
export interface EventCallback {
  id?: string
  webhook_id?: string
  payment_id?: string
  topic?: string
  callback_url?: string
  response_code?: string | null
  response_message?: string | null
  error_reason?: string | null
  status?: EventCallbackStatus
  created_at?: string
}
export interface Health {
  status?: HealthStatus
  api_version?: string
  contract_version?: string
  db?: 'ok' | 'error'
  active_chains?: number
  active_contracts?: number
  timestamp?: string
}

// ── Pagination ───────────────────────────────────────────────────────
export interface PageMeta {
  page: number
  per_page: number
  total: number
}
export interface PaginatedResponse<T> {
  data: T[]
  meta: PageMeta
}

// ── Error ────────────────────────────────────────────────────────────
export interface ApiErrorBody {
  status: string
  message?: string
}
`

// ---------------------------------------------------------------------------
// Step 3 — Resource files
// ---------------------------------------------------------------------------

const BUILD_QUERY = `
function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return \`?\${entries.map(([k, v]) => \`\${k}=\${encodeURIComponent(String(v))}\`).join('&')}\`
}
`

const PAYMENTS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type {
  Bytes32,
  CreatePaymentRequest,
  Dispute,
  PaginatedResponse,
  Payment,
  PaymentDetail,
  PayerSignatureRequest,
  PrepareRequest,
  SubmitByHashRequest,
  SubmitTransactionRequest,
  Transaction,
  TransactionOperation,
} from './types.js'

export interface ListPaymentsParams {
  status?: string
  mode?: string
  payer?: string
  payee?: string
  token?: string
  rail0_id?: string
  sort?: string
  page?: number
  per_page?: number
}

export interface ListTransactionsParams {
  operation?: string
  status?: string
  sort?: string
  page?: number
  per_page?: number
}

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /** Create a payment. Returns the PaymentDetail, including the EIP-712 signing_payload for the payer. */
  create(params: CreatePaymentRequest): Promise<PaymentDetail> {
    return this.http.post('/payments', params)
  }

  /** List payments for the authenticated wallet (payer or payee). Requires a JWT. */
  list(params?: ListPaymentsParams): Promise<PaginatedResponse<Payment>> {
    return this.http.getPaginated(\`/payments\${buildQuery(params)}\`)
  }

  /** Fetch a payment's current state (DB status + live on-chain balances + transactions). */
  get(id: Bytes32): Promise<PaymentDetail> {
    return this.http.get(\`/payments/\${id}\`)
  }

  /** List a payment's on-chain transactions. */
  transactions(id: Bytes32, params?: ListTransactionsParams): Promise<PaginatedResponse<Transaction>> {
    return this.http.getPaginated(\`/payments/\${id}/transactions\${buildQuery(params)}\`)
  }

  /** Store the payer's EIP-3009 signature (moves the payment to \`signed\`). */
  sign(id: Bytes32, params: PayerSignatureRequest): Promise<PaymentDetail> {
    return this.http.put(\`/payments/\${id}/sign\`, params)
  }

  /** List the payment's dispute open/close history. */
  disputes(id: Bytes32): Promise<Dispute[]> {
    return this.http.get(\`/payments/\${id}/disputes\`)
  }

  // ── Generic prepare/submit ─────────────────────────────────────────
  /** Build the unsigned transaction for an operation. */
  prepare(id: Bytes32, operation: TransactionOperation | 'dispute' | 'close_dispute', body?: PrepareRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/\${operation}/prepare\`, body)
  }

  /** Broadcast a signed transaction for an operation (HTTP 202, async). */
  submit(id: Bytes32, operation: TransactionOperation | 'dispute' | 'close_dispute', params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/\${operation}\`, params)
  }

  /** Record an already-broadcast transaction by hash (MetaMask signs+broadcasts in one step). */
  submitByHash(id: Bytes32, operation: TransactionOperation | 'dispute' | 'close_dispute', params: SubmitByHashRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/\${operation}/submitted\`, params)
  }

  // ── Operation-specific pairs (payee unless noted) ──────────────────
  authorizePrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/authorize/prepare\`)
  }
  authorize(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/authorize\`, params)
  }

  chargePrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/charge/prepare\`)
  }
  charge(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/charge\`, params)
  }

  capturePrepare(id: Bytes32, amount: string): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/capture/prepare\`, { amount })
  }
  capture(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/capture\`, params)
  }

  voidPrepare(id: Bytes32): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/void/prepare\`)
  }
  void(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/void\`, params)
  }

  /** Release an expired escrow (permissionless). \`from\` defaults to the payer. */
  releasePrepare(id: Bytes32, from?: string): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/release/prepare\`, from ? { from } : undefined)
  }
  release(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/release\`, params)
  }

  /**
   * Refund prepare — two-phase EIP-3009 flow.
   * Phase 1: \`{ amount }\` → Transaction carrying a signing_payload for the payee to sign.
   * Phase 2: \`{ amount, signature }\` → the unsigned on-chain refund transaction.
   */
  refundPrepare(id: Bytes32, body: PrepareRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/refund/prepare\`, body)
  }
  refund(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/refund\`, params)
  }

  /** Open a dispute (payer, signal-only). Optional bytes32 reason code. */
  disputePrepare(id: Bytes32, reason?: string): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute/prepare\`, reason ? { reason } : undefined)
  }
  dispute(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute\`, params)
  }

  /** Close a dispute (payer). Optional bytes32 reason code. */
  closeDisputePrepare(id: Bytes32, reason?: string): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute/close/prepare\`, reason ? { reason } : undefined)
  }
  closeDispute(id: Bytes32, params: SubmitTransactionRequest): Promise<Transaction> {
    return this.http.post(\`/payments/\${id}/dispute/close\`, params)
  }
}
${BUILD_QUERY}`

const WALLETS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type {
  CreateWalletRequest,
  PaginatedResponse,
  UpdateWalletRequest,
  Wallet,
  WalletBalances,
  WalletWithTokens,
} from './types.js'

export interface ListWalletsParams {
  chain_id?: number
  token_symbol?: string
  active?: boolean
  sort?: string
  page?: number
  per_page?: number
}

export interface WalletBalancesParams {
  chain_id?: number
  token_symbol?: string
}

/**
 * Wallets and their token holdings, scoped to an account. Mirrors rail0-go's
 * WalletsService. Every method is behind SIWE — a merchant manages its OWN
 * wallets here. Public, buyer-facing discovery of a merchant's accepted
 * wallets/tokens lives on PaymentMethodsResource (GET /payment_methods).
 */
export class WalletsResource {
  constructor(private readonly http: HttpClient) {}

  /** List an account's wallets, each with its token holdings nested. */
  list(account_id: string, params?: ListWalletsParams): Promise<PaginatedResponse<WalletWithTokens>> {
    return this.http.getPaginated(\`/accounts/\${account_id}/wallets\${buildQuery(params)}\`)
  }

  /** Fetch a single wallet by UUID or 0x address. */
  get(account_id: string, id_or_address: string): Promise<Wallet> {
    return this.http.get(\`/accounts/\${account_id}/wallets/\${id_or_address}\`)
  }

  /** Add a wallet to the account. */
  create(account_id: string, params: CreateWalletRequest): Promise<Wallet> {
    return this.http.post(\`/accounts/\${account_id}/wallets\`, params)
  }

  /** Update a wallet's label or active flag. */
  update(account_id: string, id: string, params: UpdateWalletRequest): Promise<Wallet> {
    return this.http.patch(\`/accounts/\${account_id}/wallets/\${id}\`, params)
  }

  /** Soft-delete (deactivate) a wallet. */
  delete(account_id: string, id: string): Promise<void> {
    return this.http.delete(\`/accounts/\${account_id}/wallets/\${id}\`)
  }

  /** Read a wallet's live on-chain balances (native + tokens). */
  balances(account_id: string, id: string, params?: WalletBalancesParams): Promise<WalletBalances> {
    return this.http.get(\`/accounts/\${account_id}/wallets/\${id}/balances\${buildQuery(params)}\`)
  }
}
${BUILD_QUERY}`

const PAYMENT_METHODS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { WalletWithTokens } from './types.js'

/**
 * Selects the merchant whose payment methods to list. Provide EXACTLY ONE:
 * account_id returns all the merchant's active wallets; address returns just
 * that one wallet. Both empty (or both set) is rejected by the gateway (400).
 */
export interface PaymentMethodsQuery {
  account_id?: string
  address?: string
}

/**
 * Public, buyer-facing discovery of a merchant's accepted payment methods
 * (GET /payment_methods). Unlike WalletsResource (behind SIWE), this needs no
 * JWT: a payer that only knows the merchant — by account id, or by one of its
 * wallet addresses — lists the active wallet/token combinations it accepts.
 */
export class PaymentMethodsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the merchant's active wallets, each with its active token holdings
   * nested under \`tokens\` (WalletWithTokens) — the same wallet-centric shape as
   * WalletsResource.list, but public and scoped by the query. An unknown
   * account/address yields an empty array. No pagination.
   */
  list(query: PaymentMethodsQuery): Promise<WalletWithTokens[]> {
    return this.http.get(\`/payment_methods\${buildQuery(query)}\`)
  }
}
${BUILD_QUERY}`

const WEBHOOKS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type {
  CreateWebhookRequest,
  EventCallback,
  PaginatedResponse,
  UpdateWebhookRequest,
  Webhook,
  WebhookWithSecret,
} from './types.js'

export interface ListWebhooksParams {
  topic?: string
  active?: boolean
  circuit_state?: 'closed' | 'open'
  sort?: string
  page?: number
  per_page?: number
}

export interface ListEventCallbacksParams {
  status?: 'pending' | 'delivered' | 'failed'
  sort?: string
  page?: number
  per_page?: number
}

/** Webhook subscriptions for the authenticated account. All methods require a JWT. */
export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  list(params?: ListWebhooksParams): Promise<PaginatedResponse<Webhook>> {
    return this.http.getPaginated(\`/webhooks\${buildQuery(params)}\`)
  }

  /** Register a webhook. The response includes the shared_secret — shown only here and on rotateSecret. */
  create(params: CreateWebhookRequest): Promise<WebhookWithSecret> {
    return this.http.post('/webhooks', params)
  }

  get(id: string): Promise<Webhook> {
    return this.http.get(\`/webhooks/\${id}\`)
  }

  update(id: string, params: UpdateWebhookRequest): Promise<Webhook> {
    return this.http.patch(\`/webhooks/\${id}\`, params)
  }

  enable(id: string): Promise<Webhook> {
    return this.http.put(\`/webhooks/\${id}/enable\`)
  }

  disable(id: string): Promise<Webhook> {
    return this.http.put(\`/webhooks/\${id}/disable\`)
  }

  /** Rotate the shared secret — returned once in the response. */
  rotateSecret(id: string): Promise<WebhookWithSecret> {
    return this.http.put(\`/webhooks/\${id}/rotate_secret\`)
  }

  /** Reset the delivery circuit breaker and re-enable the webhook. */
  resetCircuit(id: string): Promise<Webhook> {
    return this.http.put(\`/webhooks/\${id}/reset_circuit\`)
  }

  /** List delivery attempts for a webhook. */
  eventCallbacks(id: string, params?: ListEventCallbacksParams): Promise<PaginatedResponse<EventCallback>> {
    return this.http.getPaginated(\`/webhooks/\${id}/event_callbacks\${buildQuery(params)}\`)
  }

  delete(id: string): Promise<void> {
    return this.http.delete(\`/webhooks/\${id}\`)
  }
}
${BUILD_QUERY}`

const CHAINS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { Blockchain } from './types.js'

export type { Blockchain } from './types.js'

export class ChainsResource {
  constructor(private readonly http: HttpClient) {}

  /** List all active blockchains supported by RAIL0. */
  list(): Promise<Blockchain[]> {
    return this.http.get('/blockchains')
  }
}
`

const TOKENS = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { Token } from './types.js'

export type { Token } from './types.js'

export class TokensResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List active tokens, optionally filtered by chain.
   * @param chain_id Chain ID to filter by. Omit for all chains.
   */
  list(chain_id?: number): Promise<Token[]> {
    const path = chain_id && chain_id !== 0 ? \`/tokens?chain_id=\${chain_id}\` : '/tokens'
    return this.http.get(path)
  }
}
`

const HEALTH = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { Health } from './types.js'

export type { Health } from './types.js'

export class HealthResource {
  constructor(private readonly http: HttpClient) {}

  /** Report gateway liveness/readiness (DB, chain/contract counts). */
  get(): Promise<Health> {
    return this.http.get('/health')
  }
}
`

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function writeResource(name: string, content: string): Promise<void> {
  const outPath = resolve(RESOURCES_DIR, name)
  await writeFile(outPath, content, 'utf-8')
  console.log(`Generated: ${outPath}`)
}

await generateApiTypes()
await mkdir(RESOURCES_DIR, { recursive: true })
await writeFile(resolve(RESOURCES_DIR, 'types.ts'), TYPES, 'utf-8')
console.log(`Generated: ${resolve(RESOURCES_DIR, 'types.ts')}`)
await writeResource('payments.ts', PAYMENTS)
await writeResource('wallets.ts', WALLETS)
await writeResource('payment_methods.ts', PAYMENT_METHODS)
await writeResource('webhooks.ts', WEBHOOKS)
await writeResource('chains.ts', CHAINS)
await writeResource('tokens.ts', TOKENS)
await writeResource('health.ts', HEALTH)

console.log('Done.')
