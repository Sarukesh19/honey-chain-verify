/**
 * HONEY CHAIN — Demo seed (simulated IoT + AI layer)
 * ----------------------------------------------------------------------------
 * Simulates Modules 2 & 3 so the v1 verification flow has realistic data
 * behind it:
 *
 *   IoT SIMULATION: sensors emit temperature / humidity / weight / sound per
 *   hive. Realistic rules (documented, demo-explainable):
 *     - Healthy hive: 33-36 °C brood temp, 55-65 %RH, steady weight gains.
 *     - Warning:      humidity drift > 70 %RH, weight dips.
 *     - Disease risk: temperature drop < 32 °C + loud, irregular sound (>52 dB).
 *
 *   AI SIMULATION: classifier (Healthy / Warning / Disease Risk) + 7-day yield
 *   regressor, implemented as explainable threshold/linear rules — the same
 *   logic a scikit-learn model trained on this generator's synthetic dataset
 *   would learn (see README for the training-data generation logic).
 *
 *   SWAP POINT: replace `simulateReading` with an HTTP POST from real ESP32
 *   nodes; prediction functions stay unchanged.
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { appendBatchBlock } from "./ledger";

// ---- Deterministic pseudo-random (seeded) so demo data is reproducible ----
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296; // 2^32
  };
}

interface HiveProfile {
  hive_id: string;
  location: string;
  base_temp: number;
  base_humidity: number;
  base_weight: number;
  daily_gain_kg: number;
  sound_base: number;
}

// ---- AI layer (explainable rules ≈ trained model behavior) -----------------
export type HealthStatus = "healthy" | "warning" | "disease_risk";

export function classifyHealth(
  temperature: number,
  humidity: number,
  sound: number,
  weightTrendPerDay: number,
): { status: HealthStatus; action: string; risk: "low" | "medium" | "high" } {
  if (temperature < 32 && sound > 50) {
    return {
      status: "disease_risk",
      action:
        "Inspect for Varroa mites / brood disease today; isolate hive and notify the KVIC field officer.",
      risk: "high",
    };
  }
  if (humidity > 70 || weightTrendPerDay < -0.2) {
    return {
      status: "warning",
      action:
        "Improve ventilation and check for moisture buildup; re-inspect in 24h.",
      risk: "medium",
    };
  }
  return {
    status: "healthy",
    action: "No action needed — colony operating within normal range.",
    risk: "low",
  };
}

/** Yield over next 7 days (kg). Explainable linear model on colony signals. */
export function predictYield7d(
  weight: number,
  temperature: number,
  humidity: number,
  colonyStrength: number, // 0-1
  pastProductionKg: number, // last season baseline
): number {
  const base = Math.max(0, pastProductionKg) * 0.28; // seasonal carry-over
  const strengthTerm = colonyStrength * 2.4;
  const tempFit = 1 - Math.min(1, Math.abs(temperature - 34.5) / 8); // peak ~34.5°C
  const humidityFit = 1 - Math.min(1, Math.abs(humidity - 60) / 40); // peak ~60%RH
  const forageTerm = Math.max(0, weight / 40) * 0.8;
  const raw =
    (base + strengthTerm + forageTerm) *
    (0.55 + 0.45 * tempFit) *
    (0.7 + 0.3 * humidityFit);
  return Math.round(Math.max(0, raw) * 10) / 10;
}

// ---- Simulated sensor generator -------------------------------------------
function simulateReading(
  profile: HiveProfile,
  hoursAgo: number,
  rng: () => number,
) {
  const jitter = (amp: number) => (rng() - 0.5) * 2 * amp;
  const temp = profile.base_temp + jitter(1.2);
  const humidity = profile.base_humidity + jitter(6);
  const weight =
    profile.base_weight +
    profile.daily_gain_kg * (1 - hoursAgo / 24) +
    jitter(0.15);
  const sound = profile.sound_base + jitter(4);
  return {
    temperature: Math.round(temp * 10) / 10,
    humidity: Math.round(humidity * 10) / 10,
    weight: Math.round(weight * 100) / 100,
    sound: Math.round(sound * 10) / 10,
  };
}

/** One-click seed: beekeeper → 3 hives → 24h sensor stream → AI predictions
 *  → 1 honey batch sealed on the ledger. Idempotent (safe to re-run). */
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("hives").collect();
    if (existing.length > 0) {
      return { skipped: true as const, message: "Demo data already seeded." };
    }

    const now = Date.now();
    const rng = makeRng(42);

    // 1) Beekeeper (stand-in for an authenticated KVIC-registered user)
    const beekeeper_id = "BK-001";
    const beekeeper_name = "Ramesh Patil";

    // 2) Hives — profiles chosen to demo all three AI outcomes
    const hiveProfiles: HiveProfile[] = [
      {
        hive_id: "HIVE-014",
        location: "Western Ghats Apiary, Satara, MH",
        base_temp: 34.5,
        base_humidity: 60,
        base_weight: 38,
        daily_gain_kg: 1.1,
        sound_base: 42,
      },
      {
        hive_id: "HIVE-032",
        location: "Krivandi Cluster, Nashik, MH",
        base_temp: 34.1,
        base_humidity: 73,
        base_weight: 29.5,
        daily_gain_kg: 0.4,
        sound_base: 45,
      },
      {
        hive_id: "HIVE-003",
        location: "Forest Edge Apiary, Ahmednagar, MH",
        base_temp: 31.4,
        base_humidity: 62,
        base_weight: 26,
        daily_gain_kg: 0.9,
        sound_base: 54,
      },
    ];

    for (const p of hiveProfiles) {
      await ctx.db.insert("hives", {
        hive_id: p.hive_id,
        beekeeper_id,
        location: p.location,
        status: "healthy",
        installed_at: now - 90 * 24 * 3600 * 1000,
      });
    }

    // 3) 24h simulated sensor stream (readings every 2h, most recent last)
    for (const p of hiveProfiles) {
      for (let h = 24; h >= 0; h -= 2) {
        const r = simulateReading(p, h, rng);
        await ctx.db.insert("sensor_data", {
          hive_id: p.hive_id,
          ...r,
          timestamp: now - h * 3600 * 1000,
        });
      }
      // AI classification on the latest reading + weight trend
      const latest = simulateReading(p, 0, rng);
      const health = classifyHealth(
        latest.temperature,
        latest.humidity,
        latest.sound,
        p.daily_gain_kg,
      );
      await ctx.db
        .query("hives")
        .withIndex("by_hive_id", (q) => q.eq("hive_id", p.hive_id))
        .take(1)
        .then(([doc]) => doc && ctx.db.patch(doc._id, { status: health.status }));

      await ctx.db.insert("ai_predictions", {
        hive_id: p.hive_id,
        health_status: health.status,
        recommended_action: health.action,
        predicted_yield_kg: predictYield7d(
          latest.weight,
          latest.temperature,
          latest.humidity,
          0.8,
          14,
        ),
        risk_level: health.risk,
        timestamp: now,
      });

      // Alert if not healthy (demo: "Hive 03 humidity abnormally high")
      if (health.status !== "healthy") {
        await ctx.db.insert("alerts", {
          hive_id: p.hive_id,
          message:
            health.status === "warning"
              ? `Hive ${p.hive_id.slice(-3)} humidity abnormally high`
              : `Hive ${p.hive_id.slice(-3)} possible disease signature — inspect immediately`,
          severity: health.status === "warning" ? "warning" : "critical",
          timestamp: now,
        });
      }
    }

    // 4) One honey batch, sealed on the hash-chained ledger (Module 1)
    const block = await appendBatchBlock(ctx, {
      batch_id: "HC-2026-0001",
      hive_id: "HIVE-014",
      beekeeper_id,
      beekeeper_name,
      harvest_date: "2026-09-18",
      processing_date: "2026-09-19",
      packaging_date: "2026-09-20",
      quantity_kg: 12.5,
      floral_source: "Wildflower (Karvi bloom)",
      recorded_at: now,
    });
    await ctx.db.insert("honey_batches", {
      batch_id: "HC-2026-0001",
      hive_id: "HIVE-014",
      beekeeper_id,
      beekeeper_name,
      harvest_date: "2026-09-18",
      processing_date: "2026-09-19",
      packaging_date: "2026-09-20",
      quantity_kg: 12.5,
      floral_source: "Wildflower (Karvi bloom)",
      status: "verified",
      content_hash: block.content_hash,
      tx_hash: block.tx_hash,
      block_number: block.block_number,
      created_at: now,
    });

    return {
      skipped: false as const,
      message: "Seeded 3 hives, 24h sensor stream, AI predictions, 1 verified batch.",
      batch_id: "HC-2026-0001",
    };
  },
});

/** Arguments validator shared with the UI. */
export const seedArgs = v.object({});
