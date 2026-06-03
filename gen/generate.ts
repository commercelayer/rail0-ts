/**
 * Code generation pipeline for the RAIL0 SDK.
 *
 * Run with: pnpm generate
 *
 * Steps:
 *   1. Read the OpenAPI schema from the rail0 contract repo
 *   2. Generate TypeScript types via openapi-typescript → src/api.ts
 *   3. Generate src/resources/types.ts — public SDK types
 *   4. Generate src/resources/{accounts,payments,chains,tokens}.ts — resource classes
 *
 * Schema source (in priority order):
 *   1. RAIL0_SCHEMA_URL env var — remote URL (future: published with each release)
 *   2. RAIL0_SCHEMA_PATH env var — absolute path to a local openapi.json
 *   3. Default: ../rail0-api/docs/openapi.json (sibling repo on the local filesystem)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const genDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(genDir, '..')

const GENERATED_FILE = resolve(root, 'src/api.ts')
const RESOURCES_DIR  = resolve(root, 'src/resources')

const FILE_HEADER = '// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.'

function resolveSchemaSource(): URL {
  if (process.env.RAIL0_SCHEMA_URL) {
    return new URL(process.env.RAIL0_SCHEMA_URL)
  }
  const localPath = process.env.RAIL0_SCHEMA_PATH ?? resolve(root, '..', 'rail0-api', 'docs', 'openapi.json')
  return new URL(`file://${localPath}`)
}

// ---------------------------------------------------------------------------
// Step 1 — openapi-typescript → src/api.ts
// ---------------------------------------------------------------------------

async function generateTypes(): Promise<void> {
  const schemaUrl = resolveSchemaSource()
  console.log(`Reading schema: ${schemaUrl}`)
  const ast = await openapiTS(schemaUrl)
  const content = astToString(ast)

  await mkdir(resolve(root, 'src'), { recursive: true })
  await writeFile(GENERATED_FILE, content, 'utf-8')
  console.log(`Generated: ${GENERATED_FILE}`)
}

// ---------------------------------------------------------------------------
// Step 2 — src/resources/types.ts
// ---------------------------------------------------------------------------

async function generateResourceTypes(schema: Record<string, unknown>): Promise<void> {
  const schemas = (schema as any).components?.schemas ?? {}

  // Helper: map OpenAPI property def to TS type string
  function propToTsType(propDef: any): string {
    if (propDef.$ref) {
      return propDef.$ref.split('/').pop()!
    }
    if (propDef.allOf) {
      const refEntry = propDef.allOf.find((e: any) => e.$ref)
      if (refEntry) return refEntry.$ref.split('/').pop()!
    }
    const nullable = propDef.nullable ? ' | null' : ''
    switch (propDef.type) {
      case 'integer': return `number${nullable}`
      case 'boolean': return `boolean${nullable}`
      case 'string':  return `string${nullable}`
      case 'array':   return `unknown[]${nullable}`
      case 'object':  return `Record<string, unknown>${nullable}`
      default:        return `unknown${nullable}`
    }
  }

  // Generate an interface from a schema definition
  function schemaToInterface(name: string, def: any, extra?: string): string {
    const props = def.properties ?? {}
    const required: string[] = def.required ?? []
    const lines: string[] = []
    if (def.description) {
      lines.push(`/** ${def.description} */`)
    }
    lines.push(`export interface ${name} {`)
    for (const [key, propDef] of Object.entries<any>(props)) {
      const opt = required.includes(key) ? '' : '?'
      const tsType = propToTsType(propDef)
      if (propDef.description) {
        lines.push(`  /** ${propDef.description} */`)
      }
      lines.push(`  ${key}${opt}: ${tsType}`)
    }
    if (extra) lines.push(extra)
    lines.push(`}`)
    return lines.join('\n')
  }

  const parts: string[] = [
    FILE_HEADER,
    `import type { components } from '../api.js'`,
    ``,
    `// Re-export raw generated types for advanced use`,
    `export type { components, operations } from '../api.js'`,
    ``,
    `// ── Primitive aliases ────────────────────────────────────────────────`,
    `/** Checksummed or lowercase Ethereum address (42 chars, 0x-prefixed). */`,
    `export type Address = components['schemas']['Address']`,
    `/** 32-byte value, hex-encoded (66 chars, 0x-prefixed). */`,
    `export type Bytes32 = components['schemas']['Bytes32']`,
    `/** Unsigned 256-bit integer serialised as a decimal string. */`,
    `export type Uint256String = components['schemas']['Uint256String']`,
    ``,
    `// ── Request body types ───────────────────────────────────────────────`,
    `export type CreatePaymentRequest    = components['schemas']['CreatePaymentRequest']`,
    `export type CapturePaymentRequest   = components['schemas']['CapturePaymentRequest']`,
    `export type PayerSignatureRequest   = components['schemas']['PayerSignatureRequest']`,
    `export type SubmitTransactionRequest = components['schemas']['SubmitTransactionRequest']`,
    ``,
    `// ── Pagination ───────────────────────────────────────────────────────`,
    `export interface PageMeta {`,
    `  page: number`,
    `  per_page: number`,
    `  total: number`,
    `}`,
    ``,
    `export interface PaginatedResponse<T> {`,
    `  data: T[]`,
    `  meta: PageMeta`,
    `}`,
    ``,
    `// ── Inline types (not named schemas in the spec) ──────────────────────`,
    `export interface Blockchain {`,
    `  chain_id: number`,
    `  name: string`,
    `  slug: string`,
    `  network_type: string`,
    `  explorer_url: string`,
    `}`,
    ``,
    `export interface Token {`,
    `  chain_id: number`,
    `  chain_slug: string`,
    `  symbol: string`,
    `  address: string`,
    `  decimals: number`,
    `}`,
    ``,
    `export interface PaymentMethod {`,
    `  id: string`,
    `  token_id: string`,
    `  chain_id: number`,
    `  chain_name: string`,
    `  chain_slug: string`,
    `  explorer_url: string`,
    `  token_address: string`,
    `  token_symbol: string`,
    `  token_decimals: number`,
    `  wallet_address: string`,
    `  default: boolean`,
    `}`,
    ``,
    `// ── Named response schemas ────────────────────────────────────────────`,
  ]

  // Named schemas to generate (in dependency order)
  const namedSchemas = [
    'EIP712Domain',
    'EIP3009Message',
    'PaymentConfig',
    'SigningPayload',
    'CreatePaymentResponse',
    'PayerSignatureResponse',
    'PrepareTransactionResponse',
    'SubmitTransactionAcceptedResponse',
  ]

  for (const name of namedSchemas) {
    const def = schemas[name]
    if (!def) { console.warn(`Warning: schema ${name} not found`); continue }
    parts.push(schemaToInterface(name, def))
    parts.push(``)
  }

  // Inline schemas not present as named components in the spec
  parts.push(`/** A wallet token configuration linking a wallet address to a specific token on a chain. */`)
  parts.push(`export interface WalletToken {`)
  parts.push(`  id: string`)
  parts.push(`  wallet_id: string`)
  parts.push(`  address: string`)
  parts.push(`  default: boolean`)
  parts.push(`  active: boolean`)
  parts.push(`  token_id: string`)
  parts.push(`  token_symbol: string`)
  parts.push(`  token_address: string`)
  parts.push(`  token_decimals: number`)
  parts.push(`  chain_id: number`)
  parts.push(`  chain_name: string`)
  parts.push(`  chain_slug: string`)
  parts.push(`}`)
  parts.push(``)
  parts.push(`/** Condensed payment record returned by GET /payments. */`)
  parts.push(`export interface PaymentSummary {`)
  parts.push(`  rail0_id: string`)
  parts.push(`  status: string`)
  parts.push(`  mode: 'authorize' | 'charge'`)
  parts.push(`  amount: string`)
  parts.push(`  payer: string`)
  parts.push(`  payee: string`)
  parts.push(`  token: string`)
  parts.push(`  authorization_expiry: number`)
  parts.push(`  refund_expiry: number`)
  parts.push(`  metadata?: Record<string, unknown> | null`)
  parts.push(`  created_at: string`)
  parts.push(`}`)
  parts.push(``)
  parts.push(`/** An on-chain transaction attempt associated with a payment. */`)
  parts.push(`export interface TransactionRecord {`)
  parts.push(`  id: string`)
  parts.push(`  operation: 'authorize' | 'charge' | 'capture' | 'void' | 'release' | 'refund'`)
  parts.push(`  status: 'pending' | 'submitting' | 'submitted' | 'confirmed' | 'failed'`)
  parts.push(`  transaction_hash?: string | null`)
  parts.push(`  amount?: string | null`)
  parts.push(`  fee_amount: string`)
  parts.push(`  block_number?: number | null`)
  parts.push(`  error_reason?: string | null`)
  parts.push(`  pending_at?: string | null`)
  parts.push(`  submitted_at?: string | null`)
  parts.push(`  confirmed_at?: string | null`)
  parts.push(`}`)
  parts.push(``)

  // GetPaymentResponse — inline on_chain as OnChainState
  parts.push(`export interface OnChainState {`)
  parts.push(`  exists: boolean`)
  parts.push(`  capturable_amount: Uint256String`)
  parts.push(`  refundable_amount: Uint256String`)
  parts.push(`}`)
  parts.push(``)
  parts.push(schemaToInterface('GetPaymentResponse', schemas['GetPaymentResponse'] ?? {
    description: 'Current state of a payment record.',
    required: ['rail0_id','status','mode','amount','payer','payee','token','chain_id','authorization_expiry','refund_expiry'],
    properties: {
      rail0_id: { allOf: [{ $ref: '#/components/schemas/Bytes32' }] },
      status: { type: 'string' },
      mode: { type: 'string' },
      amount: { allOf: [{ $ref: '#/components/schemas/Uint256String' }] },
      payer: { allOf: [{ $ref: '#/components/schemas/Address' }] },
      payee: { allOf: [{ $ref: '#/components/schemas/Address' }] },
      token: { allOf: [{ $ref: '#/components/schemas/Address' }] },
      chain_id: { type: 'integer' },
      authorization_expiry: { type: 'integer' },
      refund_expiry: { type: 'integer' },
      metadata: { type: 'object', nullable: true },
      on_chain: { type: 'object', nullable: true },
      last_broadcast_hash: { allOf: [{ $ref: '#/components/schemas/Bytes32' }] },
      failure_code: { type: 'string' },
      failure_message: { type: 'string' },
    }
  }))
  // Override on_chain type
  parts[parts.length - 1] = parts[parts.length - 1].replace(
    'on_chain?: Record<string, unknown> | null',
    'on_chain?: OnChainState | null'
  )
  parts.push(``)

  // PrepareRefundResponse union
  parts.push(`/** Union return type for refund prepare (phase 1 returns signing_payload, phase 2 returns PrepareTransactionResponse). */`)
  parts.push(`export type PrepareRefundResponse = PrepareTransactionResponse | { signing_payload: unknown }`)
  parts.push(``)

  // Compatibility aliases for types that index.ts and signing.ts reference but are not in the spec
  parts.push(`// ── Compatibility type aliases ────────────────────────────────────────`)
  parts.push(`export type ReleaseRequest = Record<string, unknown>`)
  parts.push(`export type AuthorizePaymentResponse = SubmitTransactionAcceptedResponse`)
  parts.push(`export type ChargePaymentResponse = SubmitTransactionAcceptedResponse`)
  parts.push(`export type CapturePaymentResponse = SubmitTransactionAcceptedResponse`)
  parts.push(`export type VoidPaymentResponse = SubmitTransactionAcceptedResponse`)
  parts.push(`export type ReleasePaymentResponse = SubmitTransactionAcceptedResponse`)
  parts.push(`export type RefundPaymentResponse = SubmitTransactionAcceptedResponse`)
  parts.push(`export type PaymentResponse = GetPaymentResponse`)
  parts.push(`export type ApiErrorBody = components['schemas']['Error']`)
  parts.push(`export type PaymentMode = 'authorize' | 'charge'`)
  parts.push(`export type SignatureStatus = 'signature_stored'`)
  parts.push(``)

  const outPath = resolve(RESOURCES_DIR, 'types.ts')
  await writeFile(outPath, parts.join('\n'), 'utf-8')
  console.log(`Generated: ${outPath}`)
}

// ---------------------------------------------------------------------------
// Step 3 — Resource files
// ---------------------------------------------------------------------------

async function generateChainsResource(): Promise<void> {
  const content = `${FILE_HEADER}
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
  const outPath = resolve(RESOURCES_DIR, 'chains.ts')
  await writeFile(outPath, content, 'utf-8')
  console.log(`Generated: ${outPath}`)
}

async function generateTokensResource(): Promise<void> {
  const content = `${FILE_HEADER}
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
  const outPath = resolve(RESOURCES_DIR, 'tokens.ts')
  await writeFile(outPath, content, 'utf-8')
  console.log(`Generated: ${outPath}`)
}

async function generateAccountsResource(): Promise<void> {
  const content = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type { PaginatedResponse, PaymentMethod, WalletToken } from './types.js'

export interface ListWalletsParams {
  chain_id?: number
  chain_slug?: string
  token_symbol?: string
  active?: boolean
  page?: number
  per_page?: number
}

export class AccountsResource {
  constructor(private readonly http: HttpClient) {}

  /** Return the active payment methods (chain + token + wallet) for the given account. */
  paymentMethods(account_id: string): Promise<PaymentMethod[]> {
    return this.http.get(\`/accounts/\${account_id}/payment-methods\`)
  }

  /**
   * Return paginated wallet tokens for the given account. Public — no JWT required.
   * @example
   * const { data, meta } = await client.accounts.wallets(accountId, { token_symbol: 'USDC', active: true })
   */
  wallets(account_id: string, params?: ListWalletsParams): Promise<PaginatedResponse<WalletToken>> {
    return this.http.get(\`/accounts/\${account_id}/wallets\${buildQuery(params)}\`)
  }

  /** Return a single wallet token by id. Public — no JWT required. */
  wallet(account_id: string, id: string): Promise<WalletToken> {
    return this.http.get(\`/accounts/\${account_id}/wallets/\${id}\`)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => \`\${k}=\${encodeURIComponent(String(v))}\`).join('&')
}
`
  const outPath = resolve(RESOURCES_DIR, 'accounts.ts')
  await writeFile(outPath, content, 'utf-8')
  console.log(`Generated: ${outPath}`)
}

async function generatePaymentsResource(): Promise<void> {
  const content = `${FILE_HEADER}
import type { HttpClient } from '../core/http.js'
import type {
  Bytes32,
  CapturePaymentRequest,
  CreatePaymentRequest,
  CreatePaymentResponse,
  GetPaymentResponse,
  PaginatedResponse,
  PayerSignatureRequest,
  PayerSignatureResponse,
  PaymentSummary,
  PrepareRefundResponse,
  PrepareTransactionResponse,
  SubmitTransactionAcceptedResponse,
  SubmitTransactionRequest,
  TransactionRecord,
} from './types.js'

export interface ListPaymentsParams {
  status?: string
  mode?: string
  payer?: string
  payee?: string
  token?: string
  page?: number
  per_page?: number
}

export interface ListTransactionsParams {
  operation?: string
  status?: string
  page?: number
  per_page?: number
}

export interface RefundPrepareParams {
  amount: string
  v?: number
  r?: string
  s?: string
}

/** @deprecated Use RefundPrepareParams */
export type RefundPayloadParams = RefundPrepareParams

export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List payments for the authenticated wallet. Requires a JWT.
   * Returns a paginated response — access items via \`.data\` and pagination info via \`.meta\`.
   */
  list(params?: ListPaymentsParams): Promise<PaginatedResponse<PaymentSummary>> {
    return this.http.get(\`/payments\${buildQuery(params)}\`)
  }

  /** Create a payment intent. Returns the EIP-712 signingPayload for the payer to sign. */
  create(params: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.http.post('/payments', params)
  }

  /** Fetch current payment state (DB status + live on-chain escrow balances). */
  get(rail0_id: Bytes32): Promise<GetPaymentResponse> {
    return this.http.get(\`/payments/\${rail0_id}\`)
  }

  /**
   * List on-chain transactions for a payment.
   * Returns a paginated response — access items via \`.data\` and pagination info via \`.meta\`.
   */
  transactions(rail0_id: Bytes32, params?: ListTransactionsParams): Promise<PaginatedResponse<TransactionRecord>> {
    return this.http.get(\`/payments/\${rail0_id}/transactions\${buildQuery(params)}\`)
  }

  /** Submit the payer's EIP-712 signature (v, r, s). */
  sign(rail0_id: Bytes32, params: PayerSignatureRequest): Promise<PayerSignatureResponse> {
    return this.http.put(\`/payments/\${rail0_id}/sign\`, params)
  }

  /** Prepare the unsigned authorize() transaction. Called by the payee. */
  authorizePrepare(rail0_id: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(\`/payments/\${rail0_id}/authorize/prepare\`)
  }

  /**
   * Submit the signed authorize transaction (HTTP 202, async).
   * Poll \`get()\` until status leaves "submitting".
   */
  authorize(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(\`/payments/\${rail0_id}/authorize\`, params)
  }

  /** Prepare the unsigned charge() transaction (one-shot, no escrow). */
  chargePrepare(rail0_id: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(\`/payments/\${rail0_id}/charge/prepare\`)
  }

  /**
   * Submit the signed charge transaction (HTTP 202, async).
   * Poll \`get()\` until status leaves "submitting".
   */
  charge(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(\`/payments/\${rail0_id}/charge\`, params)
  }

  /** Build the unsigned capture() transaction. Called by the payee. */
  capturePrepare(rail0_id: Bytes32, params: CapturePaymentRequest): Promise<PrepareTransactionResponse> {
    return this.http.post(\`/payments/\${rail0_id}/capture/prepare\`, params)
  }

  /** Submit the signed capture transaction (HTTP 202, async). */
  capture(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(\`/payments/\${rail0_id}/capture\`, params)
  }

  /** Build the unsigned void() transaction. Called by the payee. */
  voidPrepare(rail0_id: Bytes32): Promise<PrepareTransactionResponse> {
    return this.http.post(\`/payments/\${rail0_id}/void/prepare\`)
  }

  /** Submit the signed void transaction (HTTP 202, async). */
  void(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(\`/payments/\${rail0_id}/void\`, params)
  }

  /** Build the unsigned release() transaction. */
  releasePrepare(rail0_id: Bytes32, params?: Record<string, unknown>): Promise<PrepareTransactionResponse> {
    return this.http.post(\`/payments/\${rail0_id}/release/prepare\`, params)
  }

  /** Submit the signed release transaction (HTTP 202, async). */
  release(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(\`/payments/\${rail0_id}/release\`, params)
  }

  /**
   * Refund prepare — two-phase EIP-3009 flow.
   * Phase 1: call with \`{ amount }\` only — returns a signing payload.
   * Phase 2: call with \`{ amount, v, r, s }\` — returns the unsigned on-chain refund transaction.
   */
  refundPrepare(rail0_id: Bytes32, params: RefundPrepareParams): Promise<PrepareRefundResponse> {
    return this.http.post(\`/payments/\${rail0_id}/refund/prepare\`, params)
  }

  /** Submit the signed refund transaction (HTTP 202, async). */
  refund(rail0_id: Bytes32, params: SubmitTransactionRequest): Promise<SubmitTransactionAcceptedResponse> {
    return this.http.post(\`/payments/\${rail0_id}/refund\`, params)
  }
}

function buildQuery(params?: object): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => \`\${k}=\${encodeURIComponent(String(v))}\`).join('&')
}
`
  const outPath = resolve(RESOURCES_DIR, 'payments.ts')
  await writeFile(outPath, content, 'utf-8')
  console.log(`Generated: ${outPath}`)
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

await generateTypes()

// Read schema for resource generation
const schemaPath = process.env.RAIL0_SCHEMA_PATH ?? resolve(root, '..', 'rail0-api', 'docs', 'openapi.json')
const schema = JSON.parse(await readFile(schemaPath, 'utf-8'))

await mkdir(RESOURCES_DIR, { recursive: true })
await generateResourceTypes(schema)
await generateChainsResource()
await generateTokensResource()
await generateAccountsResource()
await generatePaymentsResource()

console.log('Done.')
