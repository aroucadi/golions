import { NextResponse } from 'next/server';
import { kvSet } from '../../kv';

export async function POST(request: Request) {
  try {
    const { rawHeaders } = await request.json();
    if (!rawHeaders) {
      return NextResponse.json({ error: 'Missing rawHeaders' }, { status: 400 });
    }

    // Persist headers to Vercel KV
    await kvSet('golions_headers', rawHeaders);

    const isQueue = rawHeaders.includes('queueit') || rawHeaders.includes('QueueIT');
    const queueState = {
      detected: isQueue,
      provider: isQueue ? 'QUEUE_IT' : 'NONE',
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json({ success: true, queueState });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
