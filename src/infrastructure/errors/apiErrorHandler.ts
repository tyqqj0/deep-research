// src-refactored/infrastructure/errors/apiErrorHandler.ts
import { NextRequest, NextResponse } from 'next/server';
import { AppError } from './customErrors';

type ApiHandler = (req: NextRequest, params: any) => Promise<NextResponse>;

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, params: any) => {
    try {
      return await handler(req, params);
    } catch (error) {
      // In development, log the full error
      if (process.env.NODE_ENV === 'development') {
        console.error('API Route Error:', error);
      }

      if (error instanceof AppError) {
        return NextResponse.json(
          {
            error: {
              message: error.message,
              type: error.name,
              context: error.context,
            },
          },
          { status: error.statusCode }
        );
      }

      // For unknown errors, return a generic 500 response
      return NextResponse.json(
        {
          error: {
            message: 'An unexpected internal server error occurred.',
            type: 'InternalServerError',
          },
        },
        { status: 500 }
      );
    }
  };
}
