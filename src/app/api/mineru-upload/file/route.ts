import { NextRequest, NextResponse } from 'next/server';

export async function PUT(request: NextRequest) {
  try {
    // 从查询参数获取目标URL
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('target');

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'Target URL is required' },
        { status: 400 }
      );
    }

    console.log(`[Mineru Upload Proxy] Proxying file upload to: ${targetUrl}`);

    // 获取上传的文件数据
    const fileData = await request.arrayBuffer();
    console.log(`[Mineru Upload Proxy] Received ${fileData.byteLength} bytes`);

    // 代理上传到目标URL
    // 关键：不设置任何headers，特别是Content-Type，因为OSS签名是基于空headers计算的
    console.log(`[Mineru Upload Proxy] Uploading without any headers to match OSS signature`);
    
    const response = await fetch(targetUrl, {
      method: 'PUT',
      body: fileData,
      // 不设置headers对象，让fetch使用最少的默认headers
    });

    console.log(`[Mineru Upload Proxy] Upload response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mineru Upload Proxy] Upload failed:`, errorText);
      
      return NextResponse.json(
        { 
          error: 'Upload to target failed',
          status: response.status,
          details: errorText
        },
        { status: response.status }
      );
    }

    // 成功上传
    const responseData = await response.text();
    
    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('[Mineru Upload Proxy] Error:', error);
    return NextResponse.json(
      { 
        error: 'Proxy upload failed',
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
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}