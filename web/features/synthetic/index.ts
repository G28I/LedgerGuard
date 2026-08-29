/**
 * Synthetic Benchmark Generator Domain
 * Reproducible financial record generation with ground truth labels.
 */
export const SYNTHETIC_FEATURE_VERSION = '1.0.0';

export {
  generateSyntheticBenchmarkBatch,
  DEFAULT_BENCHMARK_SEED,
  DEFAULT_BENCHMARK_CASES,
} from './generator';
export type { GenerateSyntheticOptions } from './generator';
