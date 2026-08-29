import { NextResponse } from 'next/server';
import { dbRepository } from '@/features/db';
import { FEATURE7_BASELINE_SNAPSHOTS } from '@/features/benchmark';

/**
 * GET /api/reconciliation/benchmark
 * Returns static baseline snapshots (Feature 7 milestone reference points)
 * AND actual materialized database benchmark runs from PostgreSQL.
 */
export async function GET() {
  try {
    const actualBenchmarkRuns = await dbRepository.getBenchmarkRuns();

    return NextResponse.json(
      {
        baselineSnapshots: FEATURE7_BASELINE_SNAPSHOTS,
        actualBenchmarkRuns,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch benchmark history';
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 }
    );
  }
}
