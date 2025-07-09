import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const { path } = params;
    const searchParams = request.nextUrl.searchParams;
    const authHeader = request.headers.get('Authorization');
    
    console.log('Zotero proxy called with:', {
      path,
      url: request.url,
      method: request.method,
      hasAuth: !!authHeader,
      authPreview: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
      searchParams: Object.fromEntries(searchParams.entries())
    });
    
    if (!authHeader) {
      console.log('Missing authorization header');
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    // Build the Zotero API URL
    const zoteroPath = path.join('/');
    const queryString = searchParams.toString();
    const zoteroUrl = `https://api.zotero.org/${zoteroPath}${queryString ? `?${queryString}` : ''}`;

    console.log('Proxying request:', {
      originalPath: path,
      zoteroPath,
      zoteroUrl,
      queryString
    });

    // Forward the request to Zotero API
    const response = await fetch(zoteroUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Zotero-API-Version': '3',
        'User-Agent': 'Deep-Research-App/1.0'
      }
    });

    console.log('Zotero API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zotero API error:', errorText);
      return NextResponse.json(
        { error: `Zotero API error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Forward relevant headers
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/json');
    
    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Zotero-API-Version');
    
    // Copy important Zotero headers
    const importantHeaders = [
      'last-modified-version',
      'total-results',
      'link'
    ];
    
    importantHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    return NextResponse.json(data, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
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

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const { path } = params;
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const body = await request.json();
    const zoteroPath = path.join('/');
    const zoteroUrl = `https://api.zotero.org/${zoteroPath}`;

    console.log('Proxying POST request to:', zoteroUrl);

    const response = await fetch(zoteroUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Zotero-API-Version': '3',
        'User-Agent': 'Deep-Research-App/1.0'
      },
      body: JSON.stringify(body)
    });

    console.log('Zotero API POST response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zotero API POST error:', errorText);
      return NextResponse.json(
        { error: `Zotero API error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Proxy POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}