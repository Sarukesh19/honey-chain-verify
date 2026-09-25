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
  appendStageBlock,
  verifyBatchIntegrity,
} from "./ledger";

/** Shared validator for batch metadata (also documents ledger payload shape). */
const batchInput = {
  hive_id: v.string(),
  harvest_date: v.string(), // YYYY-MM-DD
  harvest_location: v.optional(v.string()),
  quantity_kg: v.number(),
  floral_source: v.string(), // honey type, e.g. "Wildflower (Karvi bloom)"
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
      harvest_location: input.harvest_location,
      processing_date: undefined,
      packaging_date: undefined,
      quantity_kg: input.quantity_kg,
      floral_source: input.floral_source,
      status: "created",
      content_hash: block.content_hash,
      tx_hash: block.tx_hash,
      block_number: block.block_number,
      created_at: now,
    });

    // 3) First traceability record: batch creation by the beekeeper.
    await ctx.db.insert("traceability_records", {
      batch_id,
      stage: "created",
      actor: input.beekeeper_name,
      note: `Batch created from ${input.hive_id} — ${input.quantity_kg} kg ${input.floral_source}`,
      block_number: block.block_number,
      tx_hash: block.tx_hash,
      recorded_at: now,
    });

    return { batch_id, tx_hash: block.tx_hash, block_number: block.block_number };
  },
});

/**
 * PROCESSOR / ADMIN ROLE: record a lifecycle stage (processed / packaged /
 * distributed) on the ledger. Creates a new chained block + traceability row.
 */
export const recordStage = mutation({
  args: {
    batch_id: v.string(),
    stage: v.union(
      v.literal("processed"),
      v.literal("packaged"),
      v.literal("distributed"),
    ),
    actor: v.string(),
    date: v.string(), // YYYY-MM-DD
    note: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const batch = (
      await ctx.db
        .query("honey_batches")
        .withIndex("by_batch_id", (q) => q.eq("batch_id", input.batch_id))
        .take(1)
    )[0];
    if (!batch) throw new Error("Batch not found.");

    // Enforce lifecycle order — no skipping stages.
    const order = ["created", "processed", "packaged", "distributed"];
    const idx = order.indexOf(batch.status);
    const nextIdx = order.indexOf(input.stage);
    if (nextIdx !== idx + 1) {
      throw new Error(
        `Batch is '${batch.status}'; next stage must be '${order[idx + 1] ?? "none"}'.`,
      );
    }

    // Seal the stage event on the ledger (tamper-evident).
    const { block_number, tx_hash } = await appendStageBlock(ctx, {
      batch_id: input.batch_id,
      stage: input.stage,
      actor: input.actor,
      note: input.note,
      recorded_at: Date.now(),
    });

    // Update the batch row with stage metadata (kept off the stage payload).
    const patch: Record<string, unknown> = { status: input.stage };
    if (input.stage === "processed") patch.processing_date = input.date;
    if (input.stage === "packaged") patch.packaging_date = input.date;
    if (input.stage === "distributed") patch.distributed_date = input.date;
    await ctx.db.patch(batch._id, patch);

    await ctx.db.insert("traceability_records", {
      batch_id: input.batch_id,
      stage: input.stage,
      actor: input.actor,
      note: input.note,
      block_number,
      tx_hash,
      recorded_at: Date.now(),
    });

    return { block_number, tx_hash, status: input.stage };
  },
});

/** Full traceability timeline for a batch (blockchain page + verify page). */
export const getBatchTimeline = query({
  args: { batch_id: v.string() },
  handler: async (ctx, { batch_id }) => {
    const records = await ctx.db
      .query("traceability_records")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", batch_id))
      .collect();
    return records.sort((a, b) => a.block_number - b.block_number);
  },
});

/** All ledger blocks for a batch — the visual blockchain trace. */
export const getBatchBlocks = query({
  args: { batch_id: v.string() },
  handler: async (ctx, { batch_id }) => {
    const blocks = await ctx.db
      .query("ledger")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", batch_id))
      .collect();
    return blocks
      .sort((a, b) => a.block_number - b.block_number)
      .map((b) => ({
        block_number: b.block_number,
        stage: b.stage ?? "batch_created",
        tx_hash: b.tx_hash,
        prev_hash: b.prev_hash,
        content_hash: b.content_hash,
        payload: JSON.parse(b.payload_json) as Record<string, unknown>,
        created_at: b.created_at,
      }));
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

    const timeline = await ctx.db
      .query("traceability_records")
      .withIndex("by_batch_id", (q) => q.eq("batch_id", batch_id))
      .collect();

    return {
      batch: {
        batch_id: batch.batch_id,
        hive_id: batch.hive_id,
        beekeeper_id: batch.beekeeper_id,
        beekeeper_name: batch.beekeeper_name,
        harvest_date: batch.harvest_date,
        harvest_location: batch.harvest_location ?? hive?.location ?? null,
        processing_date: batch.processing_date ?? null,
        packaging_date: batch.packaging_date ?? null,
        distributed_date: batch.distributed_date ?? null,
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
      timeline: timeline
        .sort((a, b) => a.block_number - b.block_number)
        .map((t) => ({
          stage: t.stage,
          actor: t.actor,
          note: t.note ?? null,
          block_number: t.block_number,
          tx_hash: t.tx_hash,
          recorded_at: t.recorded_at,
        })),
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

/** Full batch rows for the batch-management page (all lifecycle stages). */
export const listAllBatches = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db.query("honey_batches").collect();
    return batches
      .sort((a, b) => b.created_at - a.created_at)
      .map((b) => ({
        batch_id: b.batch_id,
        hive_id: b.hive_id,
        beekeeper_name: b.beekeeper_name,
        harvest_date: b.harvest_date,
        harvest_location: b.harvest_location ?? null,
        processing_date: b.processing_date ?? null,
        packaging_date: b.packaging_date ?? null,
        distributed_date: b.distributed_date ?? null,
        quantity_kg: b.quantity_kg,
        floral_source: b.floral_source,
        status: b.status,
        block_number: b.block_number,
        tx_hash: b.tx_hash,
      }));
  },
});
