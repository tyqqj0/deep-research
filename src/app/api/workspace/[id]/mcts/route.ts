import 'reflect-metadata'; // Must be the first import
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/workspace/{id}/mcts
 * A simplified handler for debugging the build error.
 * This version removes all dependencies and business logic.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // This simplified response confirms the route signature is accepted.
  return NextResponse.json({ 
    message: `Successfully received POST for workspace ID: ${id}` 
  });
}
