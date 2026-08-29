import { NextResponse } from 'next/server';
import { dbRepository } from '@/features/db';

/**
 * GET /api/reconciliation/overview
 * Fetches dashboard overview metrics (latest COMPLETED run, recent runs, exception breakdown).
 */
export async function GET() {
  try {
    const overviewMetrics = await dbRepository.getOverviewMetrics();
    return NextResponse.json(overviewMetrics, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch overview metrics';
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 }
    );
  }
}
