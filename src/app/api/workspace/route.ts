import 'reflect-metadata'; // Must be the first import
// @/app/api/workspace/route.ts

import { NextRequest, NextResponse } from 'next/server';
import 'reflect-metadata'; // Required for tsyringe
import container from '@/infrastructure/di/container';
import { IWorkspaceService } from '@/domains/workspace/services/IWorkspaceService';
import { z } from 'zod';
import { Logger } from '@/infrastructure/logging/Logger';

const workspaceService = container.resolve<IWorkspaceService>(IWorkspaceService);
const logger = Logger.getInstance();

// Schema for validating the creation request body
const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required.'),
  researchTopic: z.string().min(1, 'Research topic is required.'),
  rootLiteratureId: z.string().uuid('A valid root literature ID is required.'),
});

/**
 * POST /api/workspace
 * Creates a new workspace.
 */
export async function POST(request: NextRequest) {
  logger.info('API call: POST /api/workspace');
  try {
    const body = await request.json();
    const validationResult = CreateWorkspaceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { name, researchTopic, rootLiteratureId } = validationResult.data;

    const newWorkspace = await workspaceService.createWorkspace(
      name,
      researchTopic,
      rootLiteratureId
    );

    return NextResponse.json(newWorkspace.toJSON(), { status: 201 }); // 201 Created

  } catch (error: any) {
    logger.error('API Error in POST /api/workspace', { error: error.message });
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
