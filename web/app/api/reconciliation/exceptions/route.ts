import { NextResponse } from 'next/server';
import { dbRepository } from '@/features/db';
import type { ExceptionType, ExceptionPriority } from '@prisma/client';

/**
 * GET /api/reconciliation/exceptions
 * Fetches filtered exception queue items across runs.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as ExceptionType | null;
    const priority = searchParams.get('priority') as ExceptionPriority | null;
    const runId = searchParams.get('runId');
    const resolvedParam = searchParams.get('resolved');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    let resolved: boolean | undefined;
    if (resolvedParam === 'true') resolved = true;
    if (resolvedParam === 'false') resolved = false;

    const exceptions = await dbRepository.getExceptions({
      type: type ?? undefined,
      priority: priority ?? undefined,
      resolved,
      runId: runId ?? undefined,
      limit,
    });

    return NextResponse.json({ exceptions }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch exceptions';
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 }
    );
  }
}
