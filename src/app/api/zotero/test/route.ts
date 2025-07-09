import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const authHeader = request.headers.get('Authorization');
    
    // Test data
    const testData = {
      request: {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        searchParams: Object.fromEntries(searchParams.entries())
      },
      timestamp: new Date().toISOString(),
      message: 'Proxy test endpoint working'
    };

    console.log('Proxy test endpoint called:', testData);

    return NextResponse.json(testData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Zotero-API-Version',
      }
    });

  } catch (error) {
    console.error('Proxy test error:', error);
    return NextResponse.json(
      { error: 'Test endpoint error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Zotero-API-Version',
      'Access-Control-Max-Age': '86400',
    },
  });
}