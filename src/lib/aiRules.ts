/**
 * HONEY CHAIN — AI PROTOTYPE ANALYSIS (Rule-Based Demo Model) — Module 3
 * ============================================================================
 * There is NO live ML backend. These are transparent, documented rules
 * operating on Demo IoT Data — a rule-based demo model, clearly labeled in
 * the UI. The same function signatures accept a trained scikit-learn model
 * later without changing any UI.
 *
 * RULES (from apiculture norms for Apis cerana indica / Apis mellifera):
 * ----------------------------------------------------------------------------
 * 1. DISEASE RISK (critical):  temperature < 32°C AND sound > 50 dB
 *    → brood-nest cooling + unusually loud/irregular buzzing is the classic
 *      signature of Varroa pressure or brood disease.
 *
 * 2. WARNING:                  humidity > 70% OR weight dropping > 10%/24h
 *    → excess moisture risks fermentation/chalkbrood; weight loss suggests
 *      robbing or nectar dearth.
 *
 * 3. HEALTHY:                  otherwise (temp 32–37°C, humidity ≤ 70%,
 *                              stable/positive weight trend).
 *
 * 4. DISEASE RISK PERCENT:     78–92% when rule 1 fires (critical band),
 *                              25–45% when rule 2 fires (warning band),
 *                              0–12% when healthy (baseline noise).
 *
 * 5. ENVIRONMENTAL RISK:       high   if humidity > 72% or temp outside 31–37°C
 *                              medium if humidity > 68%
 *                              low    otherwise.
 *
 * 6. YIELD PREDICTION (kg/7d): (pastProduction × 0.28 + colonyStrength × 2.4
 *                              + weight/40 × 0.8) × tempFit × humidityFit,
 *                              where tempFit peaks at 34.5°C and humidityFit
 *                              peaks at 60% RH. Explainable linear model.
 * ============================================================================
 */

export type HealthStatus = "healthy" | "warning" | "disease_risk";

export interface SensorSample {
  temperature: number; // °C
  humidity: number; // %RH
  weight: number; // kg
  sound: number; // dB
  weightTrendPerDay?: number; // kg/day (negative = losing weight)
}

export interface RuleOutcome {
  status: HealthStatus;
  action: string;
  risk: "low" | "medium" | "high";
  diseaseRiskPct: number;
  envRisk: "low" | "medium" | "high";
  firedRules: string[]; // which rule IDs fired — shown for demo explainability
}

/** Full rule evaluation for one sensor sample. */
export function evaluateHiveRules(s: SensorSample): RuleOutcome {
  const firedRules: string[] = [];
  const trend = s.weightTrendPerDay ?? 0.8;

  // Rule 1 — Disease risk signature
  if (s.temperature < 32 && s.sound > 50) {
    firedRules.push("R1: temp<32°C ∧ sound>50dB → Disease Risk");
    return {
      status: "disease_risk",
      action:
        "Inspect for Varroa mites / brood disease today; isolate hive and notify the KVIC field officer.",
      risk: "high",
      diseaseRiskPct: 84,
      envRisk: envRiskOf(s),
      firedRules,
    };
  }

  // Rule 2 — Warning: moisture or weight loss
  if (s.humidity > 70 || trend < -0.2) {
    const why: string[] = [];
    if (s.humidity > 70) why.push(`high humidity (${s.humidity}%)`);
    if (trend < -0.2) why.push(`weight dropping ${Math.abs(trend).toFixed(1)} kg/day`);
    firedRules.push(`R2: ${why.join(" ∧ ")} → Warning`);
    return {
      status: "warning",
      action:
        "Improve ventilation and check for moisture buildup; re-inspect in 24h.",
      risk: "medium",
      diseaseRiskPct: 32,
      envRisk: envRiskOf(s),
      firedRules,
    };
  }

  // Rule 3 — Healthy
  firedRules.push("R3: within normal bands → Healthy");
  return {
    status: "healthy",
    action: "No action needed — colony operating within normal range.",
    risk: "low",
    diseaseRiskPct: 6,
    envRisk: envRiskOf(s),
    firedRules,
  };
}

function envRiskOf(s: SensorSample): "low" | "medium" | "high" {
  if (s.humidity > 72 || s.temperature > 37 || s.temperature < 31) return "high";
  if (s.humidity > 68) return "medium";
  return "low";
}

/** Yield over next 7 days (kg) — Rule 6, explainable linear model. */
export function predictYield7d(
  weight: number,
  temperature: number,
  humidity: number,
  colonyStrength: number, // 0–1
  pastProductionKg: number,
): number {
  const base = Math.max(0, pastProductionKg) * 0.28;
  const strengthTerm = colonyStrength * 2.4;
  const tempFit = 1 - Math.min(1, Math.abs(temperature - 34.5) / 8);
  const humidityFit = 1 - Math.min(1, Math.abs(humidity - 60) / 40);
  const forageTerm = Math.max(0, weight / 40) * 0.8;
  const raw =
    (base + strengthTerm + forageTerm) *
    (0.55 + 0.45 * tempFit) *
    (0.7 + 0.3 * humidityFit);
  return Math.round(Math.max(0, raw) * 10) / 10;
}

/** Anomaly warnings for the alert system (Module 8) — same thresholds. */
export function detectAnomalies(s: SensorSample): Array<{
  message: string;
  severity: "warning" | "critical";
}> {
  const out: Array<{ message: string; severity: "warning" | "critical" }> = [];
  if (s.temperature > 37.5) {
    out.push({
      message: `High temperature detected: ${s.temperature}°C — inspect hive`,
      severity: "critical",
    });
  }
  if (s.humidity > 70) {
    out.push({
      message: `High humidity detected: ${s.humidity}% — improve ventilation`,
      severity: "warning",
    });
  }
  if ((s.weightTrendPerDay ?? 0) < -0.3) {
    out.push({
      message: `Sudden hive weight decrease (${Math.abs(s.weightTrendPerDay!).toFixed(1)} kg/day) — check for robbing`,
      severity: "critical",
    });
  }
  if (s.sound > 55) {
    out.push({
      message: `Abnormal sound level: ${s.sound} dB — colony stress possible`,
      severity: "warning",
    });
  }
  return out;
}
