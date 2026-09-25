/**
 * HONEY CHAIN — Beekeeper & marketplace functions
 * ----------------------------------------------------------------------------
 * Read layer for Module 2 (smart beekeeping dashboard) and Module 4
 * (market linkage). Data is produced by `demo.ts` (simulated IoT + AI) or
 * real ingestion once ESP32 nodes exist.
 *
 * SCALING / MULTI-TENANT: every query below takes a `beekeeper_id` argument
 * that v1 accepts from the client. In production, derive it from the
 * authenticated Convex Auth user (getCurrentUser) and scope every index read
 * by it — swap points are marked SCALING below.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Latest reading per hive + AI verdict — the dashboard's primary feed. */
export const getDashboard = query({
  args: { beekeeper_id: v.string() },
  handler: async (ctx, { beekeeper_id }) => {
    const hives = await ctx.db
      .query("hives")
      .withIndex("by_hive_id", (q) => q.gte("hive_id", ""))
      .collect();
    const mine = hives.filter((h) => h.beekeeper_id === beekeeper_id);

    const now = Date.now();
    const rows = await Promise.all(
      mine.map(async (hive) => {
        // Latest sensor reading (SCALING: paginate for long histories).
        const readings = await ctx.db
          .query("sensor_data")
          .withIndex("by_hive_id", (q) => q.eq("hive_id", hive.hive_id))
          .collect();
        const latest =
          readings.length > 0
            ? readings.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
            : null;

        const prediction = (
          await ctx.db
            .query("ai_predictions")
            .withIndex("by_hive_id", (q) => q.eq("hive_id", hive.hive_id))
            .collect()
        )
          .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;

        return {
          hive_id: hive.hive_id,
          location: hive.location,
          status: hive.status,
          reading: latest
            ? {
                temperature: latest.temperature,
                humidity: latest.humidity,
                weight: latest.weight,
                sound: latest.sound,
                timestamp: latest.timestamp,
              }
            : null,
          prediction: prediction
            ? {
                health_status: prediction.health_status,
                recommended_action: prediction.recommended_action,
                predicted_yield_kg: prediction.predicted_yield_kg,
                risk_level: prediction.risk_level,
              }
            : null,
        };
      }),
    );

    // Simple aggregates for the header cards.
    const totalYield = rows.reduce(
      (sum, r) => sum + (r.prediction?.predicted_yield_kg ?? 0),
      0,
    );
    const needsAttention = rows.filter((r) => r.status !== "healthy").length;

    return {
      hives: rows,
      totals: {
        hive_count: rows.length,
        predicted_yield_kg: Math.round(totalYield * 10) / 10,
        needs_attention: needsAttention,
        last_sync: now,
      },
    };
  },
});

/** Active alerts, newest first (dashboard bell + judge demo). */
export const getAlerts = query({
  args: {},
  handler: async (ctx) => {
    const alerts = await ctx.db.query("alerts").collect();
    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  },
});

/** Verified batches for the marketplace — verified ⇒ ledger-sealed. */
export const listVerifiedBatches = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db.query("honey_batches").collect();
    return batches
      .filter((b) => b.status === "verified")
      .sort((a, b) => a.batch_id.localeCompare(b.batch_id))
      .map((b) => ({
        batch_id: b.batch_id,
        hive_id: b.hive_id,
        beekeeper_name: b.beekeeper_name,
        floral_source: b.floral_source,
        harvest_date: b.harvest_date,
        quantity_kg: b.quantity_kg,
        block_number: b.block_number,
        tx_hash: b.tx_hash,
      }));
  },
});

/** Register a new hive (Module 2 form). Default profile = healthy demo hive. */
export const createHive = mutation({
  args: {
    hive_id: v.string(),
    location: v.string(),
    beekeeper_id: v.string(),
    beekeeper_name: v.string(),
  },
  handler: async (ctx, input) => {
    const existing = await ctx.db
      .query("hives")
      .withIndex("by_hive_id", (q) => q.eq("hive_id", input.hive_id))
      .take(1);
    if (existing.length > 0) {
      throw new Error(`Hive ${input.hive_id} already exists.`);
    }
    await ctx.db.insert("hives", {
      hive_id: input.hive_id.trim().toUpperCase(),
      beekeeper_id: input.beekeeper_id,
      location: input.location,
      status: "healthy",
      installed_at: Date.now(),
    });

    // Seed an initial reading + AI verdict so the new hive appears "live".
    // (IoT SIMULATION — replace with real ESP32 ingestion, marked SCALING.)
    await ctx.db.insert("sensor_data", {
      hive_id: input.hive_id.trim().toUpperCase(),
      temperature: 34.2,
      humidity: 61,
      weight: 30 + Math.random() * 10,
      sound: 43,
      timestamp: Date.now(),
    });
    await ctx.db.insert("ai_predictions", {
      hive_id: input.hive_id.trim().toUpperCase(),
      health_status: "healthy",
      recommended_action:
        "No action needed — colony operating within normal range.",
      predicted_yield_kg: Math.round((5 + Math.random() * 3) * 10) / 10,
      risk_level: "low",
      timestamp: Date.now(),
    });
    return { hive_id: input.hive_id.trim().toUpperCase() };
  },
});

/**
 * Push one simulated sensor reading + re-run the AI rules (Module 2/3).
 * In production this is the ingestion endpoint real ESP32 nodes would call —
 * the function signature is intentionally the device payload shape.
 */
export const pushSimulatedReading = mutation({
  args: {
    hive_id: v.string(),
    temperature: v.number(),
    humidity: v.number(),
    weight: v.number(),
    sound: v.number(),
  },
  handler: async (ctx, input) => {
    const now = Date.now();
    await ctx.db.insert("sensor_data", { ...input, timestamp: now });

    // Weight trend: compare against the previous reading (~2h cadence).
    const history = await ctx.db
      .query("sensor_data")
      .withIndex("by_hive_id", (q) => q.eq("hive_id", input.hive_id))
      .collect();
    history.sort((a, b) => a.timestamp - b.timestamp);
    const prev = history.length >= 2 ? history[history.length - 2] : null;
    const trendPerDay =
      prev && now > prev.timestamp
        ? ((input.weight - prev.weight) / (now - prev.timestamp)) *
          24 * 3600 * 1000
        : 0.8;

    // Same explainable rules as the seeded AI layer (demo.ts).
    let status = "healthy";
    let action = "No action needed — colony operating within normal range.";
    let risk = "low";
    if (input.temperature < 32 && input.sound > 50) {
      status = "disease_risk";
      risk = "high";
      action =
        "Inspect for Varroa mites / brood disease today; isolate hive and notify the KVIC field officer.";
    } else if (input.humidity > 70 || trendPerDay < -0.2) {
      status = "warning";
      risk = "medium";
      action =
        "Improve ventilation and check for moisture buildup; re-inspect in 24h.";
    }

    // Update the hive status + prediction (latest wins).
    const hiveDoc = (
      await ctx.db
        .query("hives")
        .withIndex("by_hive_id", (q) => q.eq("hive_id", input.hive_id))
        .take(1)
    )[0];
    if (hiveDoc) await ctx.db.patch(hiveDoc._id, { status });

    await ctx.db.insert("ai_predictions", {
      hive_id: input.hive_id,
      health_status: status,
      recommended_action: action,
      // Yield heuristic consistent with demo.predictYield7d.
      predicted_yield_kg:
        Math.round(
          Math.max(0, (8 * 0.28 + 0.8 * 2.4 + Math.max(0, input.weight / 40) * 0.8)) *
            10,
        ) / 10,
      risk_level: risk,
      timestamp: now,
    });

    // Raise an alert when degraded.
    if (status !== "healthy") {
      await ctx.db.insert("alerts", {
        hive_id: input.hive_id,
        message:
          status === "warning"
            ? `Hive ${input.hive_id.slice(-3)} humidity abnormally high`
            : `Hive ${input.hive_id.slice(-3)} possible disease signature — inspect immediately`,
        severity: status === "warning" ? "warning" : "critical",
        timestamp: now,
      });
    }

    return { status, risk, recorded_at: now };
  },
});
