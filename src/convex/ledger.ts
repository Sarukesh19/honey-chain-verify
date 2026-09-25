/**
 * HONEY CHAIN — Ledger layer (blockchain-principles SIMULATION)
 * ============================================================================
 * This is a hash-chained, append-only ledger that mimics blockchain
 * immutability — it is NOT a live blockchain network. Design goals:
 *
 *   1. Every batch record's payload is content-hashed (SHA-256).
 *   2. Each block embeds prev_hash, so any historical edit invalidates
 *      every hash after it (tamper evidence).
 *   3. tx_hash is deterministic from the block content, so the verifier can
 *      recompute the chain independently — no trusted party required.
 *
 * BLOCKCHAIN DESIGN RULE (from the Honey Chain spec):
 *   Only batch metadata + content hashes go on the ledger.
 *   Raw high-frequency sensor data stays in the regular DB (sensor_data table)
 *   and is referenced by hive_id + time range for audits — never hashed here.
 *
 * PRODUCTION SWAP POINTS (scaling):
 *   - `BatchMetadataPayload` maps 1:1 to a Solidity struct; replace
 *     `appendBatchBlock` with a web3.py / ethers.js tx to a permissioned chain
 *     (e.g. Hyperledger Besu) or a public L2. Keep the hashing scheme
 *     byte-identical so existing batch IDs remain verifiable.
 *   - Add per-node signatures (KVIC + apiary co-op multisig) at append time.
 * ============================================================================
 */

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Genesis prev_hash for block 0. */
export const GENESIS_HASH = "0".repeat(64);

export interface BatchMetadataPayload {
  batch_id: string;
  hive_id: string;
  beekeeper_id: string;
  beekeeper_name: string;
  harvest_date: string; // YYYY-MM-DD
  processing_date: string;
  packaging_date: string;
  quantity_kg: number;
  floral_source: string;
  recorded_at: number; // epoch ms — committed to the hash
}

export interface LedgerBlock {
  batch_id: string;
  block_number: number;
  prev_hash: string;
  payload: BatchMetadataPayload;
  content_hash: string;
  tx_hash: string;
  created_at: number;
}

/** Byte-stable JSON (sorted keys) so hashes are reproducible across runtimes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** SHA-256 hex of canonical JSON — the primitive for all chain links.
 *  Uses Web Crypto so it runs in Convex's V8 runtime (and in a browser for
 *  client-side recomputation demos). */
export async function sha256Hex(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** content_hash = sha256(canonical batch metadata). Same role a Solidity
 *  contract's keccak256(abi.encode(...)) plays in production. */
export async function contentHash(payload: BatchMetadataPayload): Promise<string> {
  return sha256Hex(canonicalJson(payload));
}

/** The exact envelope whose hash becomes the block's tx_hash. */
function blockEnvelope(
  payload: BatchMetadataPayload,
  blockNumber: number,
  prevHash: string,
  content_hash: string,
  recorded_at: number,
) {
  return {
    batch_id: payload.batch_id,
    block_number: blockNumber,
    prev_hash: prevHash,
    content_hash,
    payload,
    recorded_at,
  };
}

/**
 * Build a new block (pure — no side effects). tx_hash = sha256 of the full
 * block envelope, chaining this block to the previous one.
 */
export async function buildBlock(
  payload: BatchMetadataPayload,
  blockNumber: number,
  prevHash: string,
): Promise<LedgerBlock> {
  const createdAt = Date.now();
  const content_hash = await contentHash(payload);
  return {
    batch_id: payload.batch_id,
    block_number: blockNumber,
    prev_hash: prevHash,
    payload,
    content_hash,
    tx_hash: await sha256Hex(
      canonicalJson(blockEnvelope(payload, blockNumber, prevHash, content_hash, createdAt)),
    ),
    created_at: createdAt,
  };
}

/**
 * Append a batch to the ledger. The read of the head block plus the insert
 * happen inside one transactional mutation, so concurrent batch creations
 * serialize safely (Convex mutations are serializable transactions).
 */
export async function appendBatchBlock(
  ctx: MutationCtx,
  payload: BatchMetadataPayload,
): Promise<LedgerBlock> {
  // (SCALING: in production this is where the tx to a real chain would be
  // signed & broadcast, awaiting the returned contract event txHash.)
  const [head] = await ctx.db
    .query("ledger")
    .withIndex("by_block_number", (q) => q.gte("block_number", 0))
    .order("desc")
    .take(1);

  const blockNumber = head ? head.block_number + 1 : 0;
  const prevHash = head ? head.tx_hash : GENESIS_HASH;
  const block = await buildBlock(payload, blockNumber, prevHash);

  await ctx.db.insert("ledger", {
    block_number: block.block_number,
    batch_id: block.batch_id,
    tx_hash: block.tx_hash,
    prev_hash: block.prev_hash,
    payload_json: canonicalJson(block.payload),
    content_hash: block.content_hash,
    created_at: block.created_at,
  });
  return block;
}

export interface BatchIntegrityReport {
  batch_id: string;
  computed_content_hash: string;
  on_chain_content_hash: string;
  hash_match: boolean;
  tx_hash: string;
  tx_hash_valid: boolean; // tx_hash reproducible from stored payload + prev link
  prev_hash_valid: boolean; // block correctly links to its predecessor
  chain_intact: boolean; // all checks pass
  block_number: number;
  recorded_at: number;
  anomaly: string | null;
}

/**
 * Independently recompute hashes from the stored payload and compare against
 * the ledger — the exact check the public verify page runs. Three failure
 * modes are distinguished so a demo can pinpoint what "tampering" broke:
 *   - hash_match: false    → batch fields were edited after sealing
 *   - prev_hash_valid: false → the chain link to the previous block is broken
 *   - tx_hash_valid: false → block envelope was altered
 */
export async function verifyBatchIntegrity(
  ctx: QueryCtx,
  ledgerDoc: Doc<"ledger">,
): Promise<BatchIntegrityReport> {
  const payload = JSON.parse(ledgerDoc.payload_json) as BatchMetadataPayload;
  const computed = await contentHash(payload);

  // Reproduce the tx hash from the stored payload + recorded link.
  const recomputedTx = await sha256Hex(
    canonicalJson(
      blockEnvelope(
        payload,
        ledgerDoc.block_number,
        ledgerDoc.prev_hash,
        computed,
        ledgerDoc.created_at,
      ),
    ),
  );

  // Resolve the predecessor block (or null for genesis) in this read tx.
  const prevBlock =
    ledgerDoc.block_number > 0
      ? ((
          await ctx.db
            .query("ledger")
            .withIndex("by_block_number", (q) =>
              q.eq("block_number", ledgerDoc.block_number - 1),
            )
            .take(1)
        )[0] ?? null)
      : null;

  const prev_hash_valid = prevBlock
    ? prevBlock.tx_hash === ledgerDoc.prev_hash
    : ledgerDoc.prev_hash === GENESIS_HASH;

  const hash_match = computed === ledgerDoc.content_hash;
  const tx_hash_valid = recomputedTx === ledgerDoc.tx_hash;

  let anomaly: string | null = null;
  if (!hash_match) {
    anomaly =
      "Payload content does not match the recorded content hash — batch fields were edited after being sealed.";
  } else if (!prev_hash_valid) {
    anomaly =
      "Chain link broken: this block does not connect to its predecessor's hash.";
  } else if (!tx_hash_valid) {
    anomaly = "Block envelope was altered after recording.";
  }

  return {
    batch_id: payload.batch_id,
    computed_content_hash: computed,
    on_chain_content_hash: ledgerDoc.content_hash,
    hash_match,
    tx_hash: ledgerDoc.tx_hash,
    tx_hash_valid,
    prev_hash_valid,
    chain_intact: hash_match && tx_hash_valid && prev_hash_valid,
    block_number: ledgerDoc.block_number,
    recorded_at: ledgerDoc.created_at,
    anomaly,
  };
}
