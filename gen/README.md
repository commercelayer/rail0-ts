# Code Generation

This folder contains the generation pipeline for the RAIL0 SDK. The source of truth for the API surface is [`rail0-gateway/docs/openapi.json`](../../rail0-gateway/docs/openapi.json) (a sibling repo). Running the pipeline regenerates the raw TypeScript types in `src/api.ts`, rewrites the public types (`src/resources/types.ts`) and the generated resource classes (`src/resources/*.ts` except `auth.ts`) from templates held in `generate.ts`, and emits `src/dispute-reasons.ts` from the spec's dispute-reason dictionary.

## Run

```bash
pnpm generate
```

## Schema source (in priority order)

1. `RAIL0_SCHEMA_URL` env var — remote URL (future: published with each release)
2. `RAIL0_SCHEMA_PATH` env var — absolute path to a local `openapi.json`
3. Default: `../rail0-gateway/docs/openapi.json` (sibling repo on the local filesystem)

## Workflow when the API changes

1. Regenerate `rail0-gateway/docs/openapi.json` (or point `RAIL0_SCHEMA_PATH` to a local file).
2. Run `pnpm generate` — rewrites `src/api.ts`, `src/resources/types.ts` and the generated resources.
3. Run `pnpm typecheck` — TypeScript reports every broken reference across the SDK.
4. Fix the public types if any schema names or shapes changed — in the `TYPES` template in `generate.ts`, not in `src/resources/types.ts`, which carries `GENERATED — DO NOT EDIT` and is overwritten on the next run.
5. Fix method signatures the same way, in the resource templates in `generate.ts` (`src/resources/auth.ts` is the one hand-written resource).

Steps 4 and 5 are guided by the compiler: no manual diffing of the spec is needed.

## Files

| File | Purpose |
|------|---------|
| `generate.ts` | Generation pipeline — run with `pnpm generate` |

## How `generate.ts` works

The script is a sequential pipeline. Each step is an `async` function; new steps can be appended before the final `console.log('Done.')`.

### Step 1 — Parse the schema

```
openapi.json  →  openapi-typescript (AST)
```

[`openapi-typescript`](https://github.com/openapi-ts/openapi-typescript) reads the spec and produces a TypeScript AST. It handles OpenAPI 3.1 constructs including `allOf`, `oneOf`, `$ref`, and inline schemas.

### Step 2 — Emit `src/api.ts`

```
AST  →  astToString()  →  src/api.ts
```

The AST is serialised to a TypeScript source file. The output contains three interfaces:

- **`paths`** — one entry per endpoint, keyed by path string, referencing `operations`.
- **`components`** — all named schemas (`Payment`, `PaymentState`, `TransactionResponse`, …).
- **`operations`** — request/response shapes per `operationId`, fully resolved.

The file is written as-is; it is never hand-edited.

### Step 3 — Emit `src/dispute-reasons.ts`

```
openapi.json  →  DisputeOpenReason / DisputeCloseReason / DisputeSystemCloseReason
              →  DISPUTE_OPEN_REASONS / DISPUTE_CLOSE_REASONS / DISPUTE_SYSTEM_CLOSE_REASONS
```

The dispute-reason dictionary (rail0-gateway#381) is published as three string-enum schemas, each with two arrays aligned to `enum` **by index**: `x-enum-descriptions` (English text) and `x-enum-bytes32` (the on-chain value, `keccak256("rail0.dispute.<code>")`). The step reads the spec as JSON (same source as Step 1), turns each schema into a `readonly DisputeReasonEntry[]` of `{ code, description, bytes32 }`, and emits the `lookupDisputeReason` helper with them. It **fails the run** when the arrays differ in length or a bytes32 is not the keccak256 of its code, so a misaligned spec cannot ship.

### How the output is consumed

`src/resources/types.ts` imports `components` and `operations` from `src/api.ts` and re-exports named aliases (`Payment`, `AuthorizeParams`, `TransactionResponse`, …) that the rest of the SDK uses. This indirection means that:

- `src/api.ts` can be fully regenerated without touching any other file.
- If a schema is renamed in the spec, only the `TYPES` template (which emits `src/resources/types.ts`) needs updating — resource classes and the public index are unaffected.
- A field added to a spec schema reaches `src/api.ts` on its own, but reaches a public type only if that type is an alias of the component (`Blockchain`, `ChainContract`, `Nonce`, `Session` are). A type written out field by field in the template has to be extended by hand — prefer an alias whenever the SDK needs no narrower shape than the schema's, which is how `Blockchain` came to lack `contract` before 1.2.0.

### Adding a generation step

Append a new `async function` to `generate.ts` and call it in the pipeline section at the bottom:

```typescript
async function generateDocs(): Promise<void> {
  // read src/api.ts, emit docs, etc.
}

await generateApiTypes()
// … the types.ts and resource writes …
await generateDocs() // ← add here
console.log('Done.')
```
