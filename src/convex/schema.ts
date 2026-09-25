import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // =====================================================================
    // HONEY CHAIN — traceability tables (KVIC Honey Mission prototype, v1)
    // =====================================================================

    /** Registered hives. SCALING: add device_auth table for real ESP32
     *  sensor hardware and per-beekeeper multi-tenant scoping. */
    hives: defineTable({
      hive_id: v.string(), // public id, e.g. "HIVE-014"
      beekeeper_id: v.string(),
      location: v.string(),
      status: v.string(), // healthy | warning | disease_risk
      installed_at: v.number(),
    }).index("by_hive_id", ["hive_id"]),

    /** Hash-chained append-only ledger (SIMULATED blockchain — see ledger.ts).
     *  Real-chain swap point: replace appendBlock with an Ethers/Hardhat tx. */
    ledger: defineTable({
      block_number: v.number(),
      batch_id: v.string(),
      tx_hash: v.string(), // sha256(block payload) — doubles as the record id
      prev_hash: v.string(),
      payload_json: v.string(), // exact hashed content, kept public for verify
      content_hash: v.string(),
      created_at: v.number(),
    })
      .index("by_batch_id", ["batch_id"])
      .index("by_block_number", ["block_number"]),

    /** One row per honey batch. Sensor data stays OFF-chain by design. */
    honey_batches: defineTable({
      batch_id: v.string(), // public id, e.g. "HC-2026-0007"
      hive_id: v.string(),
      beekeeper_id: v.string(),
      beekeeper_name: v.string(),
      harvest_date: v.string(), // YYYY-MM-DD
      processing_date: v.string(),
      packaging_date: v.string(),
      quantity_kg: v.number(),
      floral_source: v.string(),
      status: v.string(), // verified | pending
      content_hash: v.string(),
      tx_hash: v.string(),
      block_number: v.number(),
      created_at: v.number(),
    }).index("by_batch_id", ["batch_id"]),

    /** Alerts feed for the future beekeeper dashboard (Module 2). */
    alerts: defineTable({
      hive_id: v.string(),
      message: v.string(),
      severity: v.string(), // info | warning | critical
      timestamp: v.number(),
    }).index("by_hive_id", ["hive_id"]),

    /** AI outputs (colony health classifier + yield regressor) (Module 3). */
    ai_predictions: defineTable({
      hive_id: v.string(),
      health_status: v.string(),
      recommended_action: v.string(),
      predicted_yield_kg: v.number(),
      risk_level: v.string(),
      timestamp: v.number(),
    }).index("by_hive_id", ["hive_id"]),

    /** Simulated IoT time-series (Module 2) — Postgres-equivalent store.
     *  NEVER written to the ledger; audit references hive_id + time range. */
    sensor_data: defineTable({
      hive_id: v.string(),
      temperature: v.number(), // °C
      humidity: v.number(), // %RH
      weight: v.number(), // kg
      sound: v.number(), // dB
      timestamp: v.number(),
    }).index("by_hive_id", ["hive_id"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
