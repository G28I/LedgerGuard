import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dbRepository } from '@/features/db';

const resolveExceptionSchema = z.object({
  resolvedBy: z.string().min(1).max(100).optional(),
  resolutionNotes: z.string().max(1000).optional(),
});

/**
 * PATCH /api/reconciliation/exceptions/[id]
 * Updates exception resolution state in PostgreSQL.
 * If no explicit reviewer identity is provided, uses "DEMO_OPERATOR" (unauthenticated demo environment fallback).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Exception ID is required' }, { status: 400 });
    }

    let bodyJson = {};
    try {
      bodyJson = await request.json();
    } catch {
      // Empty body allowed
    }

    const validationResult = resolveExceptionSchema.safeParse(bodyJson);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Default to "DEMO_OPERATOR" for unauthenticated demo environment
    const resolvedBy = validationResult.data.resolvedBy || 'DEMO_OPERATOR';
    const resolutionNotes = validationResult.data.resolutionNotes;

    const updatedException = await dbRepository.resolveException(id, {
      resolvedBy,
      resolutionNotes,
    });

    if (!updatedException) {
      return NextResponse.json({ error: 'Exception not found or failed to resolve' }, { status: 404 });
    }

    return NextResponse.json({ exception: updatedException }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resolve exception';
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 }
    );
  }
}
