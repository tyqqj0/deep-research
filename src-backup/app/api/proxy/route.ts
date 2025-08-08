import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
    }

    try {
        console.log(`[Proxy] Fetching URL: ${targetUrl}`);
        // Fetch the resource from the target URL
        const fileResponse = await fetch(targetUrl, {
            headers: {
                // Pretend to be a browser to avoid getting blocked
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            redirect: 'follow'
        });

        if (!fileResponse.ok) {
            const errorText = await fileResponse.text();
            console.error(`[Proxy] Failed to fetch from target: ${fileResponse.statusText}`, errorText);
            return NextResponse.json(
                { error: `Failed to fetch from target: ${fileResponse.statusText}`, details: errorText },
                { status: fileResponse.status }
            );
        }

        // Create a new response to stream the file body
        // and copy over the relevant headers from the original response.
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', fileResponse.headers.get('Content-Type') || 'application/octet-stream');
        responseHeaders.set('Content-Length', fileResponse.headers.get('Content-Length') || '');
        responseHeaders.set('Content-Disposition', fileResponse.headers.get('Content-Disposition') || 'attachment');

        return new NextResponse(fileResponse.body, {
            status: fileResponse.status,
            statusText: fileResponse.statusText,
            headers: responseHeaders
        });
    } catch (error) {
        console.error('[URL Proxy] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to proxy URL', details: errorMessage }, { status: 500 });
    }
} 