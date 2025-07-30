import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const userId = searchParams.get('userId');

    if (!apiKey || !userId) {
      return NextResponse.json(
        { error: 'Missing API key or user ID' },
        { status: 400 }
      );
    }

    console.log('Zotero API Test: Fetching collections for user:', userId);

    const zoteroApiUrl = `https://api.zotero.org/users/${userId}/collections`;

    // 构造Zotero API请求
    const response = await fetch(zoteroApiUrl, {
      method: 'GET',
      headers: {
        'Zotero-API-Version': '3',
        'Zotero-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Zotero API Error', details: errorData },
        { status: response.status }
      );
    }

    const collections = await response.json();
    return NextResponse.json(collections, {
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