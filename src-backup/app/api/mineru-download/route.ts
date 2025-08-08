import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[Mineru Download Proxy] Downloading: ${targetUrl}`);

    // 代理下载请求
    const response = await fetch(targetUrl);

    if (!response.ok) {
      console.error(`[Mineru Download Proxy] Download failed: ${response.status}`);
      return NextResponse.json(
        { 
          error: 'Download failed',
          status: response.status,
          details: await response.text()
        },
        { status: response.status }
      );
    }

    // 获取响应数据
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    console.log(`[Mineru Download Proxy] Downloaded ${data.byteLength} bytes`);

    // 返回文件数据
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('[Mineru Download Proxy] Error:', error);
    return NextResponse.json(
      { 
        error: 'Proxy download failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}