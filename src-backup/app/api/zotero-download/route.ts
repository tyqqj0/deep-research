
import { NextRequest, NextResponse } from 'next/server';
import { zoteroService } from '@/libs/zotero/ZoteroService';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const downloadUrl = searchParams.get('url');
    const apiKey = req.headers.get('X-Zotero-API-Key');

    if (!downloadUrl) {
        return NextResponse.json({ error: 'Missing download URL' }, { status: 400 });
    }

    if (!apiKey) {
        return NextResponse.json({ error: 'Missing Zotero API Key' }, { status: 401 });
    }

    try {
        // We directly call the downloadFile method from the singleton instance
        const fileResponse = await zoteroService.downloadFile(downloadUrl, apiKey);

        // Create a new response to stream the file body
        // and copy over the relevant headers from the original response.
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', fileResponse.headers.get('Content-Type') || 'application/pdf');
        responseHeaders.set('Content-Length', fileResponse.headers.get('Content-Length') || '');
        responseHeaders.set(
            'Content-Disposition',
            fileResponse.headers.get('Content-Disposition') || `attachment; filename="download.pdf"`
        );

        return new NextResponse(fileResponse.body, {
            status: fileResponse.status,
            statusText: fileResponse.statusText,
            headers: responseHeaders
        });
    } catch (error) {
        console.error('[Zotero Download Proxy] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json(
            { error: 'Failed to download file from Zotero', details: errorMessage },
            { status: 500 }
        );
    }
} 