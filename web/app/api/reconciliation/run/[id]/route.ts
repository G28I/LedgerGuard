import { NextResponse } from 'next/server';
import { dbRepository } from '@/features/db';

/**
 * GET /api/reconciliation/run/[id]
 * Fetches full details for a specific reconciliation run including results and exceptions.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 });
    }

    const runDetails = await dbRepository.getRunDetails(id);
    if (!runDetails) {
      return NextResponse.json({ error: 'Reconciliation run not found' }, { status: 404 });
    }

    return NextResponse.json(runDetails, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch run details';
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 }
    );
  }
}
