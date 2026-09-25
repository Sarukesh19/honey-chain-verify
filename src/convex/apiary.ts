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
import { classifyHealth } from "./demo";
import { predictYield7d } from "./demo";

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
          colony_strength: hive.colony_strength ?? "medium",
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
                disease_risk_pct: prediction.disease_risk_pct ?? null,
                env_risk: prediction.env_risk ?? null,
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
    const healthy = rows.filter((r) => r.status === "healthy").length;

    // Total honey produced = sum of distributed + packaged batch quantities.
    const allBatches = await ctx.db.query("honey_batches").collect();
    const totalProducedKg = allBatches
      .filter(
        (b) =>
          b.beekeeper_id === beekeeper_id &&
          (b.status === "distributed" || b.status === "packaged"),
      )
      .reduce((s, b) => s + b.quantity_kg, 0);

    // Recent batches for the dashboard list.
    const recentBatches = allBatches
      .filter((b) => b.beekeeper_id === beekeeper_id)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 5)
      .map((b) => ({
        batch_id: b.batch_id,
        hive_id: b.hive_id,
        quantity_kg: b.quantity_kg,
        floral_source: b.floral_source,
        status: b.status,
        harvest_date: b.harvest_date,
      }));

    return {
      hives: rows,
      totals: {
        hive_count: rows.length,
        healthy_count: healthy,
        needs_attention: needsAttention,
        predicted_yield_kg: Math.round(totalYield * 10) / 10,
        total_produced_kg: Math.round(totalProducedKg * 10) / 10,
        batch_count: allBatches.filter((b) => b.beekeeper_id === beekeeper_id)
          .length,
        last_sync: now,
      },
      recentBatches,
    };
  },
});

/** Full detail for one hive: readings history + latest AI analysis. */
export const getHiveDetails = query({
  args: { hive_id: v.string() },
  handler: async (ctx, { hive_id }) => {
    const hive = (
      await ctx.db
        .query("hives")
        .withIndex("by_hive_id", (q) => q.eq("hive_id", hive_id))
        .take(1)
    )[0];
    if (!hive) return null;

    const readings = await ctx.db
      .query("sensor_data")
      .withIndex("by_hive_id", (q) => q.eq("hive_id", hive_id))
      .collect();
    readings.sort((a, b) => a.timestamp - b.timestamp);

    const prediction = (
      await ctx.db
        .query("ai_predictions")
        .withIndex("by_hive_id", (q) => q.eq("hive_id", hive_id))
        .collect()
    ).sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;

    return {
      hive: {
        hive_id: hive.hive_id,
        beekeeper_name: hive.beekeeper_name ?? "—",
        location: hive.location,
        hive_age_days: hive.hive_age_days ?? null,
        colony_strength: hive.colony_strength ?? "medium",
        status: hive.status,
        installed_at: hive.installed_at,
      },
      // Chart-ready series, oldest → newest (cap at last 40 for UI).
      readings: readings.slice(-40).map((r) => ({
        temperature: r.temperature,
        humidity: r.humidity,
        weight: r.weight,
        sound: r.sound,
        timestamp: r.timestamp,
      })),
      prediction: prediction
        ? {
            health_status: prediction.health_status,
            recommended_action: prediction.recommended_action,
            predicted_yield_kg: prediction.predicted_yield_kg,
            risk_level: prediction.risk_level,
            disease_risk_pct: prediction.disease_risk_pct ?? null,
            env_risk: prediction.env_risk ?? null,
            timestamp: prediction.timestamp,
          }
        : null,
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

/**
 * ANALYTICS (Module 9): cross-hive time series + production/health charts.
 * All series are chart-ready and clearly derived from Demo IoT Data.
 */
export const getAnalytics = query({
  args: { hive_id: v.optional(v.string()) },
  handler: async (ctx, { hive_id }) => {
    const hives = await ctx.db.query("hives").collect();
    const targets = hive_id
      ? hives.filter((h) => h.hive_id === hive_id)
      : hives;

    // Time series per hive (oldest → newest, capped for UI).
    const series = await Promise.all(
      targets.map(async (h) => {
        const readings = await ctx.db
          .query("sensor_data")
          .withIndex("by_hive_id", (q) => q.eq("hive_id", h.hive_id))
          .collect();
        readings.sort((a, b) => a.timestamp - b.timestamp);
        return {
          hive_id: h.hive_id,
          points: readings.slice(-40).map((r) => ({
            t: r.timestamp,
            temperature: r.temperature,
            humidity: r.humidity,
            weight: r.weight,
            sound: r.sound,
          })),
        };
      }),
    );

    // Health distribution (healthy vs warning vs critical donut).
    const healthCounts = { healthy: 0, warning: 0, disease_risk: 0 };
    for (const h of hives) {
      if (h.status === "healthy") healthCounts.healthy++;
      else if (h.status === "warning") healthCounts.warning++;
      else healthCounts.disease_risk++;
    }

    // Production: actual (packaged+distributed) vs predicted (AI) per hive.
    const batches = await ctx.db.query("honey_batches").collect();
    const predictions = await ctx.db.query("ai_predictions").collect();
    const production = targets.map((h) => {
      const actual = batches
        .filter(
          (b) =>
            b.hive_id === h.hive_id &&
            (b.status === "packaged" || b.status === "distributed"),
        )
        .reduce((s, b) => s + b.quantity_kg, 0);
      const predicted = predictions
        .filter((p) => p.hive_id === h.hive_id)
        .sort((a, b) => b.timestamp - a.timestamp)[0]?.predicted_yield_kg ?? 0;
      return { hive_id: h.hive_id, actual, predicted };
    });

    return { series, healthCounts, production };
  },
});

/** DEMO RESET — clears all Honey Chain tables so seedDemoData can re-run.
 *  Prototype-only; production backends would never expose this. */
export const resetDemo = mutation({
  args: {},
  handler: async (ctx) => {
    for (const table of [
      "hives",
      "sensor_data",
      "ledger",
      "honey_batches",
      "traceability_records",
      "alerts",
      "ai_predictions",
    ] as const) {
      const docs = await ctx.db.query(table).collect();
      for (const doc of docs) await ctx.db.delete(doc._id);
    }
    return { cleared: true };
  },
});

/** Batches for the marketplace — every batch here is ledger-sealed. */
export const listVerifiedBatches = query({
  args: {},
  handler: async (ctx) => {
    const batches = await ctx.db.query("honey_batches").collect();
    return batches
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
    hive_age_days: v.optional(v.number()),
    colony_strength: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const existing = await ctx.db
      .query("hives")
      .withIndex("by_hive_id", (q) => q.eq("hive_id", input.hive_id))
      .take(1);
    if (existing.length > 0) {
      throw new Error(`Hive ${input.hive_id} already exists.`);
    }
    const hiveId = input.hive_id.trim().toUpperCase();
    await ctx.db.insert("hives", {
      hive_id: hiveId,
      beekeeper_id: input.beekeeper_id,
      beekeeper_name: input.beekeeper_name,
      location: input.location,
      hive_age_days: input.hive_age_days ?? 0,
      colony_strength: input.colony_strength ?? "medium",
      status: "healthy",
      installed_at: Date.now() - (input.hive_age_days ?? 0) * 24 * 3600 * 1000,
    });

    // Seed an initial reading + AI verdict so the new hive appears "live".
    // (IoT SIMULATION — replace with real ESP32 ingestion, marked SCALING.)
    await ctx.db.insert("sensor_data", {
      hive_id: hiveId,
      temperature: 34.2,
      humidity: 61,
      weight: 30 + Math.random() * 10,
      sound: 43,
      timestamp: Date.now(),
    });
    await ctx.db.insert("ai_predictions", {
      hive_id: hiveId,
      health_status: "healthy",
      recommended_action:
        "No action needed — colony operating within normal range.",
      predicted_yield_kg: Math.round((5 + Math.random() * 3) * 10) / 10,
      risk_level: "low",
      disease_risk_pct: Math.round(Math.random() * 8),
      env_risk: "low",
      timestamp: Date.now(),
    });
    return { hive_id: hiveId };
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

    // ---- ALERT SYSTEM (Module 8): specific rules per condition ------------
    // Avoid duplicate spam: only alert if no similar alert in last 30 min.
    const recentAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_hive_id", (q) => q.eq("hive_id", input.hive_id))
      .collect();
    const thirtyMin = 30 * 60 * 1000;
    const hasRecent = (substr: string) =>
      recentAlerts.some(
        (a) => a.message.includes(substr) && now - a.timestamp < thirtyMin,
      );

    const raise = (message: string, severity: string) => {
      if (!hasRecent(substrFor(message))) {
        void ctx.db.insert("alerts", {
          hive_id: input.hive_id,
          message,
          severity,
          timestamp: now,
        });
      }
    };
    const substrFor = (m: string) => m.slice(0, 24);

    if (input.temperature > 37.5) {
      raise(
        `High temperature detected: ${input.temperature}°C — inspect hive`,
        "critical",
      );
    }
    if (input.humidity > 70) {
      raise(
        `High humidity detected: ${input.humidity}% — improve ventilation`,
        "warning",
      );
    }
    if (trendPerDay < -0.3) {
      raise(
        `Sudden hive weight decrease (${trendPerDay.toFixed(1)} kg/day) — check for robbing`,
        "critical",
      );
    }
    if (input.sound > 55) {
      raise(`Abnormal sound level: ${input.sound} dB — colony stress possible`, "warning");
    }
    if (status === "disease_risk") {
      raise(
        `Possible disease risk — Varroa/brood inspection required immediately`,
        "critical",
      );
    } else if (status === "warning") {
      raise(`Possible colony stress — monitor closely`, "warning");
    }

    return { status, risk, recorded_at: now };
  },
});
