/**
 * HONEY CHAIN — DATA LAYER (single point of data access) — Module 11
 * ============================================================================
 * Every UI component reads/writes data EXCLUSIVELY through this module —
 * never through `api.*` directly. This is the "database-ready" seam:
 *
 *   Entity names here mirror the eventual SQL schema exactly:
 *     users · beekeepers · hives · sensor_data · honey_batches
 *     traceability_records · alerts · ai_predictions · ledger
 *
 *   Persistence note: this prototype persists to the project's managed Convex
 *   backend (a live, reactive database) rather than localStorage — stronger
 *   than the localStorage brief, same goal: nothing resets mid-demo. To swap
 *   to Supabase/PostgreSQL later, re-implement ONLY the functions in this
 *   file; no UI component changes are required.
 *
 *   SWAP EXAMPLE (future):
 *     export function useHives() {
 *       const [hives, setHives] = useState<Hive[]>([]);
 *       useEffect(() => { supabase.from("hives").select("*").then(...) }, []);
 *       return hives;
 *     }
 * ============================================================================
 */

import { useQuery, useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

// ---- Entity types (mirror the DB schema 1:1) -------------------------------

export type Role = "beekeeper" | "processor" | "consumer";

export interface Hive {
  hive_id: string;
  location: string;
  status: string; // healthy | warning | disease_risk
  colony_strength: string;
  beekeeper_name: string;
  reading: {
    temperature: number;
    humidity: number;
    weight: number;
    sound: number;
    timestamp: number;
  } | null;
  prediction: {
    health_status: string;
    recommended_action: string;
    predicted_yield_kg: number;
    risk_level: string;
    disease_risk_pct: number | null;
    env_risk: string | null;
  } | null;
}

export interface SensorReading {
  temperature: number;
  humidity: number;
  weight: number;
  sound: number;
  timestamp: number;
}

export interface HoneyBatch {
  batch_id: string;
  hive_id: string;
  beekeeper_name: string;
  harvest_date: string;
  harvest_location: string | null;
  processing_date: string | null;
  packaging_date: string | null;
  distributed_date: string | null;
  quantity_kg: number;
  floral_source: string;
  status: string;
  block_number: number;
  tx_hash: string;
}

export interface TraceabilityRecord {
  stage: string;
  actor: string;
  note: string | null;
  block_number: number;
  tx_hash: string;
  recorded_at: number;
}

export interface LedgerBlock {
  block_number: number;
  stage: string;
  tx_hash: string;
  prev_hash: string;
  content_hash: string;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface Alert {
  _id: string;
  hive_id: string;
  message: string;
  severity: string; // normal | warning | critical
  timestamp: number;
  resolved_at?: number; // set once an operator closes the alert
}

export interface DashboardTotals {
  hive_count: number;
  healthy_count: number;
  needs_attention: number;
  predicted_yield_kg: number;
  total_produced_kg: number;
  batch_count: number;
}

export interface AiAnalysis {
  health_status: string;
  recommended_action: string;
  predicted_yield_kg: number;
  risk_level: string;
  disease_risk_pct: number | null;
  env_risk: string | null;
}

// ---- Demo beekeeper profiles ---------------------------------------------
// The prototype has no real per-user auth yet (Convex Auth provides the
// session, not a KVIC beekeeper registry), so the active beekeeper is a DEMO
// login selection: pick a profile → every query below is scoped to it.
// SCALING: replace with authenticated user → beekeeper lookup.
export interface BeekeeperProfile {
  id: string;
  name: string;
}

export const BEEKEEPER_PROFILES: BeekeeperProfile[] = [
  { id: "BK-001", name: "Ramesh Patil" },
  { id: "BK-002", name: "Sunita Devi" },
];

/** Kept for backward compatibility (docs/tests referencing BK-001). */
export const CURRENT_BEEKEEPER = BEEKEEPER_PROFILES[0];

const ACTIVE_PROFILE_KEY = "honeychain.activeProfile";
const PROFILE_EVENT = "honeychain:profile";

function readActiveProfile(): BeekeeperProfile {
  if (typeof window === "undefined") return BEEKEEPER_PROFILES[0];
  try {
    const raw = window.localStorage.getItem(ACTIVE_PROFILE_KEY);
    const id = raw != null ? (JSON.parse(raw) as string) : null;
    return BEEKEEPER_PROFILES.find((p) => p.id === id) ?? BEEKEEPER_PROFILES[0];
  } catch {
    return BEEKEEPER_PROFILES[0];
  }
}

function writeActiveProfile(p: BeekeeperProfile) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(p.id));
    } catch {
      // storage unavailable (private mode) — profile stays in-memory only
    }
  }
}

/**
 * DEMO LOGIN (no password): selects the active beekeeper profile.
 * Persists to localStorage so the choice survives navigation; all components
 * using this hook re-render reactively when the profile changes. Every data
 * hook below takes the active profile's id so switching users switches their
 * hives, batches and stats.
 */
export function useDemoProfile() {
  const [profile, setProfileState] =
    useState<BeekeeperProfile>(readActiveProfile);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<BeekeeperProfile>).detail;
      setProfileState(detail ?? readActiveProfile());
    };
    window.addEventListener(PROFILE_EVENT, onChange);
    return () => window.removeEventListener(PROFILE_EVENT, onChange);
  }, []);

  const setProfile = useCallback((p: BeekeeperProfile) => {
    writeActiveProfile(p);
    window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: p }));
  }, []);

  return { profile, setProfile, profiles: BEEKEEPER_PROFILES };
}

// ============================================================================
// QUERIES — UI components import these; each maps to one SQL-shaped read.
// ============================================================================

/** Dashboard aggregate: hives with latest readings + AI, totals, recent batches. */
export function useDashboard(beekeeperId: string = CURRENT_BEEKEEPER.id) {
  const result = useQuery(api.apiary.getDashboard, { beekeeper_id: beekeeperId });
  if (result === undefined) return undefined;
  return {
    hives: result.hives as Hive[],
    totals: result.totals as DashboardTotals,
    recentBatches: result.recentBatches,
  };
}

/** Hive detail: info + full sensor history + latest AI analysis. */
export function useHiveDetails(hiveId: string) {
  const result = useQuery(api.apiary.getHiveDetails, { hive_id: hiveId });
  if (result === undefined) return undefined;
  if (result === null) return null;
  return {
    hive: result.hive,
    readings: result.readings as SensorReading[],
    analysis: result.prediction as AiAnalysis | null,
  };
}

/** Cross-hive analytics series for the charts page/section. */
export function useAnalytics() {
  const result = useQuery(api.apiary.getAnalytics, {});
  if (result === undefined) return undefined;
  return result;
}

/** Alerts feed, newest first. */
export function useAlerts(): Alert[] | undefined {
  const result = useQuery(api.apiary.getAlerts, {});
  return result as Alert[] | undefined;
}

/** All batch IDs (demo shortcuts / QR generator). */
export function useBatchIds(): string[] | undefined {
  return useQuery(api.traceability.listBatchIds, {});
}

/** Full batch rows for batch management. */
export function useAllBatches(): HoneyBatch[] | undefined {
  return useQuery(api.traceability.listAllBatches, {}) as
    | HoneyBatch[]
    | undefined;
}

/** Marketplace rows. */
export function useMarketplaceBatches() {
  return useQuery(api.apiary.listVerifiedBatches, {});
}

/** Public verification lookup (customer QR scan). */
export function useBatchVerification(batchId: string) {
  return useQuery(api.traceability.getBatchForVerification, { batch_id: batchId });
}

/** Lifecycle timeline for one batch. */
export function useBatchTimeline(batchId: string) {
  return useQuery(
    api.traceability.getBatchTimeline,
    batchId ? { batch_id: batchId } : "skip",
  );
}

/** Ledger blocks for one batch (blockchain page). */
export function useBatchBlocks(batchId: string) {
  return useQuery(
    api.traceability.getBatchBlocks,
    batchId ? { batch_id: batchId } : "skip",
  ) as LedgerBlock[] | undefined;
}

// ============================================================================
// MUTATIONS — one per write; signatures = future SQL calls.
// ============================================================================

export function useCreateHive() {
  return useMutation(api.apiary.createHive);
}

/** Edit hive details (location / colony strength / status). */
export function useUpdateHive() {
  return useMutation(api.apiary.updateHive);
}

/** Remove a hive + its sensor/AI/alert history (batches stay on-chain). */
export function useDeleteHive() {
  return useMutation(api.apiary.deleteHive);
}

/** Associated-data preview used by the delete-confirmation dialog. */
export function useHiveAssociations(hiveId: string) {
  return useQuery(
    api.apiary.getHiveAssociations,
    hiveId ? { hive_id: hiveId } : "skip",
  );
}

/** Mark an alert resolved (kept in history). */
export function useResolveAlert() {
  return useMutation(api.apiary.resolveAlert);
}

/** Alert history log for one hive (active + resolved, newest first). */
export function useHiveAlertHistory(hiveId: string) {
  return useQuery(
    api.apiary.getHiveAlertHistory,
    hiveId ? { hive_id: hiveId } : "skip",
  ) as Alert[] | undefined;
}

export function usePushReading() {
  return useMutation(api.apiary.pushSimulatedReading);
}

export function useCreateBatch() {
  return useMutation(api.traceability.createBatch);
}

/** Edit a batch BEFORE finalization (seals a "batch_amended" ledger block). */
export function useUpdateBatch() {
  return useMutation(api.traceability.updateBatch);
}

/** Processor/Admin stage recording (→ new ledger block). */
export function useRecordStage() {
  return useMutation(api.traceability.recordStage);
}

export function useSeedDemoData() {
  return useMutation(api.demo.seedDemoData);
}

export function useResetDemo() {
  return useMutation(api.apiary.resetDemo);
}

/**
 * Demo IoT stream helper: pushes one simulated reading for a hive.
 * (Kept here so components never build device payloads themselves.)
 */
export function useSimulatedSensorStream() {
  const push = usePushReading();
  return (hiveId: string) =>
    push({
      hive_id: hiveId,
      temperature: Math.round((34 + (Math.random() - 0.5) * 2.4) * 10) / 10,
      humidity: Math.round((62 + (Math.random() - 0.5) * 10) * 10) / 10,
      weight: Math.round((34 + Math.random() * 6) * 100) / 100,
      sound: Math.round((43 + (Math.random() - 0.5) * 6) * 10) / 10,
    });
}
