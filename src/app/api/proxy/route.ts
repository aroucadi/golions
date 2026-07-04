import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, method, headers, payload } = body;

    if (!url) {
      return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
    }

    // Clean headers to avoid host/content-length conflicts
    const cleanedHeaders: Record<string, string> = {};
    if (headers) {
      for (const [key, val] of Object.entries(headers)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'host' && lowerKey !== 'content-length' && lowerKey !== 'accept-encoding') {
          cleanedHeaders[key] = val as string;
        }
      }
    }

    const response = await fetch(url, {
      method: method || 'POST',
      headers: cleanedHeaders,
      body: payload ? JSON.stringify(payload) : undefined
    });

    const data = await response.json().catch(() => null);

    return NextResponse.json({
      status: response.status,
      ok: response.ok,
      data
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Proxy request failed' }, { status: 500 });
  }
}
