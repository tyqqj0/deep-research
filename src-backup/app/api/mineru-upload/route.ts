import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { uploadUrl, fileSize } = await request.json();
    
    if (!uploadUrl) {
      return NextResponse.json(
        { error: 'Upload URL is required' },
        { status: 400 }
      );
    }

    console.log(`[Mineru Upload Proxy] Preparing upload for ${fileSize} bytes to: ${uploadUrl}`);

    // 验证URL是否为阿里云OSS
    if (!uploadUrl.includes('aliyuncs.com')) {
      return NextResponse.json(
        { error: 'Only Aliyun OSS URLs are supported' },
        { status: 400 }
      );
    }

    // 返回代理上传URL
    // 前端会向这个URL发送PUT请求上传文件
    const proxyUploadUrl = `/api/mineru-upload/file?target=${encodeURIComponent(uploadUrl)}`;

    return NextResponse.json({ 
      proxyUploadUrl,
      message: 'Proxy upload URL generated successfully'
    });

  } catch (error) {
    console.error('[Mineru Upload Proxy] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to prepare upload proxy',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}