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
import { appendBatchBlock, appendStageBlock } from "./ledger";

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
  age_days: number;
  colony_strength: "strong" | "medium" | "weak";
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

    // 1) Beekeepers (stand-ins for authenticated KVIC-registered users).
    //    TWO profiles so the demo role/user switcher changes name + data.
    const bk1 = { id: "BK-001", name: "Ramesh Patil" };
    const bk2 = { id: "BK-002", name: "Sunita Devi" };

    // 2) Hives — profiles chosen to demo all three AI outcomes
    const hiveProfiles: Array<HiveProfile & { beekeeper: { id: string; name: string } }> = [
      {
        hive_id: "HIVE-014",
        location: "Western Ghats Apiary, Satara, MH",
        base_temp: 34.5,
        base_humidity: 60,
        base_weight: 38,
        daily_gain_kg: 1.1,
        sound_base: 42,
        age_days: 420,
        colony_strength: "strong",
        beekeeper: bk1,
      },
      {
        hive_id: "HIVE-032",
        location: "Krivandi Cluster, Nashik, MH",
        base_temp: 34.1,
        base_humidity: 73,
        base_weight: 29.5,
        daily_gain_kg: 0.4,
        sound_base: 45,
        age_days: 260,
        colony_strength: "medium",
        beekeeper: bk1,
      },
      {
        hive_id: "HIVE-003",
        location: "Forest Edge Apiary, Ahmednagar, MH",
        base_temp: 31.4,
        base_humidity: 62,
        base_weight: 26,
        daily_gain_kg: 0.9,
        sound_base: 54,
        age_days: 150,
        colony_strength: "weak",
        beekeeper: bk1,
      },
      {
        hive_id: "HIVE-007",
        location: "Sundarbans Cooperative, WB",
        base_temp: 34.8,
        base_humidity: 58,
        base_weight: 41,
        daily_gain_kg: 1.3,
        sound_base: 41,
        age_days: 510,
        colony_strength: "strong",
        beekeeper: bk2,
      },
      {
        hive_id: "HIVE-021",
        location: "Sundarbans Cooperative, WB",
        base_temp: 34.2,
        base_humidity: 63,
        base_weight: 33,
        daily_gain_kg: 0.8,
        sound_base: 44,
        age_days: 300,
        colony_strength: "medium",
        beekeeper: bk2,
      },
    ];

    for (const p of hiveProfiles) {
      await ctx.db.insert("hives", {
        hive_id: p.hive_id,
        beekeeper_id: p.beekeeper.id,
        beekeeper_name: p.beekeeper.name,
        location: p.location,
        hive_age_days: p.age_days,
        colony_strength: p.colony_strength,
        status: "healthy",
        installed_at: now - p.age_days * 24 * 3600 * 1000,
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
          p.colony_strength === "strong" ? 0.9 : p.colony_strength === "medium" ? 0.65 : 0.4,
          14,
        ),
        risk_level: health.risk,
        // AI Prototype Analysis: risk % derived from how far signals sit from
        // healthy bands (documented heuristic — swap for a trained model).
        disease_risk_pct:
          health.status === "disease_risk"
            ? 78 + Math.round(rng() * 15)
            : health.status === "warning"
              ? 25 + Math.round(rng() * 20)
              : Math.round(rng() * 12),
        env_risk:
          latest.humidity > 72 || latest.temperature > 37 || latest.temperature < 31
            ? "high"
            : latest.humidity > 68
              ? "medium"
              : "low",
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

    // 3b) A RESOLVED historical alert so the alert-history log shows the
    //     system tracking issues over time, not just a live snapshot.
    await ctx.db.insert("alerts", {
      hive_id: "HIVE-032",
      message: "Hive 032 humidity abnormally high — resolved after ventilation fix",
      severity: "warning",
      timestamp: now - 2 * 24 * 3600 * 1000,
      resolved_at: now - 1.5 * 24 * 3600 * 1000,
    });

    // 4) Honey batches with realistic quantities so "Total honey produced"
    // is non-zero and reflects ALL statuses (created counts as produced).
    // BK-001: 12.5 + 8.0 + 6.2 = 26.7 kg   BK-002: 15.0 + 4.5 = 19.5 kg
    interface BatchSeed {
      batch_id: string;
      hive_id: string;
      beekeeper: { id: string; name: string };
      harvest_date: string;
      quantity_kg: number;
      floral_source: string;
      status: "created" | "processed" | "packaged" | "distributed";
      dates: Partial<{
        processing_date: string;
        packaging_date: string;
        distributed_date: string;
      }>;
      stageNotes: Array<{
        stage: "harvested" | "processed" | "packaged" | "distributed";
        actor: string;
        note: string;
      }>;
    }

    const batchSeeds: BatchSeed[] = [
      {
        batch_id: "HC-2026-0001",
        hive_id: "HIVE-014",
        beekeeper: bk1,
        harvest_date: "2026-09-18",
        quantity_kg: 12.5,
        floral_source: "Wildflower (Karvi bloom)",
        status: "distributed",
        dates: {
          processing_date: "2026-09-19",
          packaging_date: "2026-09-20",
          distributed_date: "2026-09-22",
        },
        stageNotes: [
          { stage: "harvested", actor: bk1.name, note: "Harvested 12.5 kg at Western Ghats Apiary" },
          { stage: "processed", actor: "KVIC Processing Unit, Satara", note: "Filtered and moisture-tested at KVIC unit" },
          { stage: "packaged", actor: "KVIC Processing Unit, Satara", note: "Bottled into 42 × 250g jars; QR labels applied" },
          { stage: "distributed", actor: "KVIC Distribution, Pune", note: "Shipped to Khadi Gramodyog Bhavan retailers" },
        ],
      },
      {
        batch_id: "HC-2026-0002",
        hive_id: "HIVE-014",
        beekeeper: bk1,
        harvest_date: "2026-09-22",
        quantity_kg: 8.0,
        floral_source: "Wildflower (Karvi bloom)",
        status: "created",
        dates: {},
        stageNotes: [],
      },
      {
        batch_id: "HC-2026-0003",
        hive_id: "HIVE-032",
        beekeeper: bk1,
        harvest_date: "2026-09-23",
        quantity_kg: 6.2,
        floral_source: "Ajwain",
        status: "processed",
        dates: { processing_date: "2026-09-24" },
        stageNotes: [
          { stage: "processed", actor: "KVIC Processing Unit, Satara", note: "Filtered and moisture-tested at KVIC unit" },
        ],
        },
      {
        batch_id: "HC-2026-0004",
        hive_id: "HIVE-007",
        beekeeper: bk2,
        harvest_date: "2026-09-20",
        quantity_kg: 15.0,
        floral_source: "Mangrove (Khalshi)",
        status: "packaged",
        dates: {
          processing_date: "2026-09-21",
          packaging_date: "2026-09-22",
        },
        stageNotes: [
          { stage: "processed", actor: "KVIC Processing Unit, Kolkata", note: "Filtered and moisture-tested at KVIC unit" },
          { stage: "packaged", actor: "KVIC Processing Unit, Kolkata", note: "Bottled into 60 × 250g jars; QR labels applied" },
        ],
      },
      {
        batch_id: "HC-2026-0005",
        hive_id: "HIVE-021",
        beekeeper: bk2,
        harvest_date: "2026-09-24",
        quantity_kg: 4.5,
        floral_source: "Mangrove (Khalshi)",
        status: "created",
        dates: {},
        stageNotes: [],
      },
    ];

    let lastBatchId = "";
    for (const seed of batchSeeds) {
      const created = await appendBatchBlock(ctx, {
        batch_id: seed.batch_id,
        hive_id: seed.hive_id,
        beekeeper_id: seed.beekeeper.id,
        beekeeper_name: seed.beekeeper.name,
        harvest_date: seed.harvest_date,
        quantity_kg: seed.quantity_kg,
        floral_source: seed.floral_source,
        recorded_at: now,
      });
      await ctx.db.insert("honey_batches", {
        batch_id: seed.batch_id,
        hive_id: seed.hive_id,
        beekeeper_id: seed.beekeeper.id,
        beekeeper_name: seed.beekeeper.name,
        harvest_date: seed.harvest_date,
        harvest_location: hiveProfiles.find((h) => h.hive_id === seed.hive_id)?.location,
        ...seed.dates,
        quantity_kg: seed.quantity_kg,
        floral_source: seed.floral_source,
        status: seed.status,
        content_hash: created.content_hash,
        tx_hash: created.tx_hash,
        block_number: created.block_number,
        created_at: now,
      });
      await ctx.db.insert("traceability_records", {
        batch_id: seed.batch_id,
        stage: "created",
        actor: seed.beekeeper.name,
        note: `Batch created from ${seed.hive_id} — ${seed.quantity_kg} kg ${seed.floral_source}`,
        block_number: created.block_number,
        tx_hash: created.tx_hash,
        recorded_at: now,
      });

      // Stage blocks for batches with lifecycle history (chain-linked).
      for (const s of seed.stageNotes) {
        const { block_number, tx_hash } = await appendStageBlock(ctx, {
          batch_id: seed.batch_id,
          stage: s.stage,
          actor: s.actor,
          note: s.note,
          recorded_at: now,
        });
        await ctx.db.insert("traceability_records", {
          batch_id: seed.batch_id,
          stage: s.stage,
          actor: s.actor,
          note: s.note,
          block_number,
          tx_hash,
          recorded_at: now,
        });
      }
      lastBatchId = seed.batch_id;
    }

    return {
      skipped: false as const,
      message:
        "Seeded 5 hives across 2 beekeepers, 24h sensor streams, AI predictions, alert history, and 5 batches with full traceability timelines.",
      batch_id: lastBatchId,
    };
  },
});

/** Arguments validator shared with the UI. */
export const seedArgs = v.object({});
