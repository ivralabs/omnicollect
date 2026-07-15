/**
 * OmniCollect Score Algorithm
 *
 * score = (
 *   impressions_score  × 0.35  +   // daily impressions vs network average
 *   vehicle_quality    × 0.25  +   // % premium vehicle classes (SUV, bakkie)
 *   dwell_time_score   × 0.20  +   // avg dwell vs network average
 *   consistency_score  × 0.15  +   // how stable/predictable the traffic is
 *   anomaly_penalty    × 0.05      // deduct for frequent underperformance events
 * ) × 100
 *
 * Each component 0–1 normalised. Returns integer 0–100.
 */

export interface ScoreInput {
  /** Total vehicle count over the 7-day window */
  totalVehicles: number;
  /** Network average total vehicles over the same 7-day window */
  networkAvgVehicles: number;
  /** Vehicle class breakdown: {suv, bakkie, bus, truck, car, motorcycle, ...} */
  vehicleClasses: Record<string, number>;
  /** Average dwell time in seconds */
  avgDwellSecs: number;
  /** Network average dwell time in seconds */
  networkAvgDwellSecs: number;
  /** Coefficient of variation of daily vehicle counts (stddev/mean). Lower = more consistent. */
  dailyCv: number;
  /** Number of anomaly alerts triggered in the 7-day window */
  anomalyCount: number;
}

const PREMIUM_CLASSES = ['suv', 'bakkie', 'truck', 'bus'];

/** Normalise a value against a reference, capped at 1.0 */
function normalise(value: number, reference: number): number {
  if (reference <= 0) return 0;
  return Math.min(value / reference, 1);
}

export function calculateScore(input: ScoreInput): number {
  const {
    totalVehicles,
    networkAvgVehicles,
    vehicleClasses,
    avgDwellSecs,
    networkAvgDwellSecs,
    dailyCv,
    anomalyCount,
  } = input;

  // 1. Impressions score — how does this site compare to network average?
  const impressionsScore = normalise(totalVehicles, networkAvgVehicles);

  // 2. Vehicle quality — % premium classes
  const totalClassified = Object.values(vehicleClasses).reduce((a, b) => a + b, 0);
  const premiumCount = PREMIUM_CLASSES.reduce((sum, cls) => sum + (vehicleClasses[cls] ?? 0), 0);
  const vehicleQuality = totalClassified > 0 ? premiumCount / totalClassified : 0;

  // 3. Dwell time score
  const dwellTimeScore = normalise(avgDwellSecs, networkAvgDwellSecs);

  // 4. Consistency score — lower CV = more consistent = higher score
  // CV of 0 → perfect, CV of 1 → 0 score
  const consistencyScore = Math.max(0, 1 - dailyCv);

  // 5. Anomaly penalty — each alert reduces score by 0.1, capped at 1.0 deduction
  const anomalyPenalty = Math.min(anomalyCount * 0.1, 1.0);
  // Invert: lower anomalyPenalty is better
  const anomalyScore = 1 - anomalyPenalty;

  const raw =
    impressionsScore * 0.35 +
    vehicleQuality * 0.25 +
    dwellTimeScore * 0.20 +
    consistencyScore * 0.15 +
    anomalyScore * 0.05;

  return Math.round(Math.min(Math.max(raw * 100, 0), 100));
}

/**
 * Quick recalculation from last 7 days of site_readings.
 * Called by the ingest API after each new reading.
 */
export async function recalculateScoreFromReadings(readings: Array<{
  vehicle_count: number;
  vehicle_classes: Record<string, number>;
  avg_dwell_secs: number;
}>): Promise<number> {
  if (readings.length === 0) return 0;

  const totalVehicles = readings.reduce((s, r) => s + r.vehicle_count, 0);
  const avgDwellSecs = readings.reduce((s, r) => s + r.avg_dwell_secs, 0) / readings.length;

  // Merge vehicle classes
  const mergedClasses: Record<string, number> = {};
  for (const r of readings) {
    for (const [cls, count] of Object.entries(r.vehicle_classes ?? {})) {
      mergedClasses[cls] = (mergedClasses[cls] ?? 0) + count;
    }
  }

  // Compute daily CV (simplified: use reading-level variance)
  const mean = totalVehicles / readings.length;
  const variance =
    readings.reduce((s, r) => s + Math.pow(r.vehicle_count - mean, 2), 0) / readings.length;
  const stddev = Math.sqrt(variance);
  const dailyCv = mean > 0 ? stddev / mean : 0;

  // Use 2× the site's own average as a conservative network benchmark
  // until real cross-network data is available from multiple sites.
  // This ensures a site isn't scoring 100/100 by default.
  const networkAvgVehicles = totalVehicles > 0 ? totalVehicles * 1.5 : 1;
  const networkAvgDwellSecs = avgDwellSecs > 0 ? avgDwellSecs * 1.5 : 1;

  return calculateScore({
    totalVehicles,
    networkAvgVehicles,
    vehicleClasses: mergedClasses,
    avgDwellSecs,
    networkAvgDwellSecs,
    dailyCv,
    anomalyCount: 0, // anomaly count fetched separately in ingest route
  });
}
