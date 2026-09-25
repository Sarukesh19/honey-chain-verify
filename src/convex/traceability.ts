/**
 * HONEY CHAIN — Traceability functions
 * ----------------------------------------------------------------------------
 * Module 1 (batch creation + ledger write + QR payload) and the public
 * verification lookup for the customer QR page.
 *
 * QR / VERIFICATION FLOW:
 *   createBatch → appendBatchBlock (hash-chained ledger) → returns batch_id
 *   Customer scans QR → /verify/{batch_id} → getBatchForVerification query →
 *   server recomputes the content hash + chain link and reports tamper status.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  appendBatchBlock,
  verifyBatchIntegrity,
} from "./ledger";

/** Shared validator for batch metadata (also documents ledger payload shape). */
const batchInput = {
  hive_id: v.string(),
  harvest_date: v.string(), // YYYY-MM-DD
  processing_date: v.string(),
  packaging_date: v.string(),
  quantity_kg: v.number(),
  floral_source: v.string(),
  beekeeper_id: v.string(),
  beekeeper_name: v.string(),
};

/**
 * Create a honey batch and seal it on the hash-chained ledger.
 * PUBLIC for the v1 prototype (no auth) so demo data can be generated from
 * the UI. SCALING / MULTI-TENANT: require an authenticated beekeeper here and
 * scope every read by beekeeper_id / KVIC cluster.
 */
export const createBatch = mutation({
  args: batchInput,
  handler: async (ctx, input) => {
    const now = Date.now();
    // Human-friendly, sequential public ID: HC-2026-0007
    const count = await ctx.db.query("honey_batches").collect();
    const batch_id = `HC-${new Date(now).getFullYear()}-${String(
      count.length + 1,
    ).padStart(4, "0")}`;

    // 1) Write the batch row (DB copy for app queries — the ledger is truth).
    const block = await appendBatchBlock(ctx, {
      batch_id,
      hive_id: input.hive_id,
      beekeeper_id: input.beekeeper_id,
      beekeeper_name: input.beekeeper_name,
      harvest_date: input.harvest_date,
      processing_date: input.processing_date,
      packaging_date: input.packaging_date,
      quantity_kg: input.quantity_kg,
      floral_source: input.floral_source,
      recorded_at: now,
    });

    // 2) Record the batch with its on-chain pointers.
    await ctx.db.insert("honey_batches", {
      batch_id,
      hive_id: input.hive_id,
      beekeeper_id: input.beekeeper_id,
      beekeeper_name: input.beekeeper_name,
      harvest_date: input.harvest_date,
      processing_date: input.processing_date,
      packaging_date: input.packaging_date,
      quantity_kg: input.quantity_kg,
      floral_source: input.floral_source,
      status: "verified",
      content_hash: block.content_hash,
      tx_hash: block.tx_hash,
      block_number: block.block_number,
      created_at: now,
    });

    return { batch_id, tx_hash: block.tx_hash, block_number: block.block_number };
  },
});

/** Sealed payload exactly as stored on the ledger (for QR data + audit). */
export const getBatchPayload = query({
  args: { batch_id: v.string() },
  handler: async (ctx, { batch_id }) => {
    const ledgerDoc = (
      await ctx.db
        .query("ledger")
        .withIndex("by_batch_id", (q) => q.eq("batch_id", batch_id))
        .take(1)
    )[0];
    if (!ledgerDoc) return null;
    return JSON.parse(ledgerDoc.payload_json) as Record<string, unknown>;
  },
});

/**
 * Public traceability lookup — powers /verify/{batch_id}. No auth required:
 * a customer scanning a jar QR lands here directly.
 * Returns batch + hive + tamper-check report in one round trip.
 */
export const getBatchForVerification = query({
  args: { batch_id: v.string() },
  handler: async (ctx, { batch_id }) => {
    const batch = (
      await ctx.db
        .query("honey_batches")
        .withIndex("by_batch_id", (q) => q.eq("batch_id", batch_id))
        .take(1)
    )[0];
    if (!batch) return null;

    const ledgerDoc = (
      await ctx.db
        .query("ledger")
        .withIndex("by_batch_id", (q) => q.eq("batch_id", batch_id))
        .take(1)
    )[0];

    const hive = (
      await ctx.db
        .query("hives")
        .withIndex("by_hive_id", (q) => q.eq("hive_id", batch.hive_id))
        .take(1)
    )[0];

    const integrity = ledgerDoc
      ? await verifyBatchIntegrity(ctx, ledgerDoc)
      : null;

    return {
      batch: {
        batch_id: batch.batch_id,
        hive_id: batch.hive_id,
        beekeeper_id: batch.beekeeper_id,
        beekeeper_name: batch.beekeeper_name,
        harvest_date: batch.harvest_date,
        processing_date: batch.processing_date,
        packaging_date: batch.packaging_date,
        quantity_kg: batch.quantity_kg,
        floral_source: batch.floral_source,
        status: batch.status,
        content_hash: batch.content_hash,
        tx_hash: batch.tx_hash,
        block_number: batch.block_number,
        created_at: batch.created_at,
      },
      hive: hive
        ? { hive_id: hive.hive_id, location: hive.location, status: hive.status }
        : null,
      integrity,
    };
  },
});

/** Batch IDs for demo shortcuts / marketplace lists. */
export const listBatchIds = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db.query("honey_batches").collect();
    return batches
      .sort((a, b) => a.block_number - b.block_number)
      .map((b) => b.batch_id);
  },
});
