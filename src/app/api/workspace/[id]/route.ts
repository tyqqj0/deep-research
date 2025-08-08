import 'reflect-metadata'; // Must be the first import
// @/app/api/workspace/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import container from '../../../../infrastructure/di/container';
import { IWorkspaceService } from '../../../../domains/workspace/services/IWorkspaceService';
import { z } from 'zod';
import { Logger } from '../../../../infrastructure/logging/Logger';

const workspaceService = container.resolve<IWorkspaceService>(IWorkspaceService);
const logger = Logger.getInstance();

// Schema for validating the update request body
const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  researchTopic: z.string().min(1).optional(),
});

interface ApiContext {
    params: {
        id: string;
    }
}

/**
 * GET /api/workspace/{id}
 * Retrieves a single workspace by its ID.
 */
export async function GET(
  request: NextRequest,
  context: ApiContext
) {
  const { id } = context.params;
  logger.info('API call: GET /api/workspace/{id}', { id });
  try {
    const workspace = await workspaceService.getWorkspace(id);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    return NextResponse.json(workspace.toJSON());
  } catch (error: any) {
    logger.error('API Error in GET /api/workspace/{id}', { id, error: error.message });
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/workspace/{id}
 * Updates an existing workspace's details.
 */
export async function PUT(
  request: NextRequest,
  context: ApiContext
) {
  const { id } = context.params;
  logger.info('API call: PUT /api/workspace/{id}', { id });
  try {
    const workspace = await workspaceService.getWorkspace(id);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = UpdateWorkspaceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    // Update workspace properties if provided
    if (validationResult.data.name) {
      workspace.name = validationResult.data.name;
    }
    if (validationResult.data.researchTopic) {
        workspace.researchTopic = validationResult.data.researchTopic;
    }
    
    await workspaceService.updateWorkspace(workspace);

    return NextResponse.json(workspace.toJSON());

  } catch (error: any) {
    logger.error('API Error in PUT /api/workspace/{id}', { id, error: error.message });
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/workspace/{id}
 * Deletes a workspace.
 */
export async function DELETE(
  request: NextRequest,
  context: ApiContext
) {
  const { id } = context.params;
  logger.info('API call: DELETE /api/workspace/{id}', { id });
  try {
    await workspaceService.deleteWorkspace(id);
    return new NextResponse(null, { status: 204 }); // No Content on successful deletion
  } catch (error: any) {
    logger.error('API Error in DELETE /api/workspace/{id}', { id, error: error.message });
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
