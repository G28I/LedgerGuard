import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reconciliationService } from '@/features/reconciliation';
import { dbRepository } from '@/features/db';

// Zod Input Validation Schema
const executeRunSchema = z.object({
  seed: z.number().int().optional(),
  batchName: z.string().min(1).max(100).optional(),
  enableAI: z.boolean().optional(),
});

/**
 * POST /api/reconciliation/run
 * Triggers a synchronous end-to-end reconciliation run over a benchmark batch.
 */
export async function POST(request: Request) {
  try {
    let bodyJson = {};
    try {
      bodyJson = await request.json();
    } catch {
      // Empty body defaults to default seed
    }

    const validationResult = executeRunSchema.safeParse(bodyJson);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const summaryResponse = await reconciliationService.executeRun(validationResult.data);

    if (summaryResponse.status === 'FAILED') {
      return NextResponse.json(summaryResponse, { status: 500 });
    }

    return NextResponse.json(summaryResponse, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json(
      { error: 'Internal Reconciliation Service Error', message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reconciliation/run
 * Fetches recent reconciliation runs and audit summary metrics.
 */
export async function GET() {
  try {
    const recentRuns = await dbRepository.getRecentRuns(10);
    return NextResponse.json({ runs: recentRuns }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch runs';
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation runs', message },
      { status: 500 }
    );
  }
}
