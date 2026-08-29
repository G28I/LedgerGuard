export interface BaselineSnapshot {
  id: string;
  name: string;
  type: 'BASELINE_SNAPSHOT';
  versionTag: string;
  totalRecords: number;
  matchedCount: number;
  unresolvedCount: number;
  resolutionRate: number; // Ratio e.g. 0.60
  accuracy: number; // Ratio e.g. 0.925
  precision: number; // Ratio e.g. 1.0
  recall: number; // Ratio e.g. 1.0
  f1Score: number; // Ratio e.g. 1.0
  aiCallCount: number;
  aiEvaluatedCount: number;
  aiPromotedCount: number;
  aiFalsePositiveCount: number;
  description: string;
}

/**
 * Authoritative Feature 7 Baseline Reference Snapshots
 * Immutable research baselines preserved as milestone reference snapshots.
 * Note: Metric representations are strict decimal ratios (e.g. 0.925 for 92.5%).
 */
export const FEATURE7_BASELINE_SNAPSHOTS: BaselineSnapshot[] = [
  {
    id: 'baseline-deterministic',
    name: 'Deterministic Baseline',
    type: 'BASELINE_SNAPSHOT',
    versionTag: 'v1.0-deterministic',
    totalRecords: 200,
    matchedCount: 120,
    unresolvedCount: 80,
    resolutionRate: 0.60,
    accuracy: 0.925,
    precision: 1.0,
    recall: 1.0,
    f1Score: 1.0,
    aiCallCount: 0,
    aiEvaluatedCount: 0,
    aiPromotedCount: 0,
    aiFalsePositiveCount: 0,
    description: 'Pure rule engine without AI. Exact reference, amount, currency, and normalized fuzzy rules.',
  },
  {
    id: 'baseline-initial-ai',
    name: 'Initial AI Baseline (Pre-Fix)',
    type: 'BASELINE_SNAPSHOT',
    versionTag: 'v2.0-initial-ai',
    totalRecords: 200,
    matchedCount: 130,
    unresolvedCount: 70,
    resolutionRate: 0.65,
    accuracy: 0.875,
    precision: 0.9231,
    recall: 1.0,
    f1Score: 0.960,
    aiCallCount: 44,
    aiEvaluatedCount: 44,
    aiPromotedCount: 10,
    aiFalsePositiveCount: 10,
    description: 'Initial AI integration without ambiguous tie safety gate. 10 false positive promotions.',
  },
  {
    id: 'baseline-fixed-ai',
    name: 'Fixed AI Baseline (Safety Protected)',
    type: 'BASELINE_SNAPSHOT',
    versionTag: 'v2.1-fixed-ai',
    totalRecords: 200,
    matchedCount: 120,
    unresolvedCount: 80,
    resolutionRate: 0.60,
    accuracy: 0.925,
    precision: 1.0,
    recall: 1.0,
    f1Score: 1.0,
    aiCallCount: 26,
    aiEvaluatedCount: 26,
    aiPromotedCount: 0,
    aiFalsePositiveCount: 0,
    description: 'Protected AMBIGUOUS_MATCH_TIE safety gate + candidate separation rule.',
  },
];
